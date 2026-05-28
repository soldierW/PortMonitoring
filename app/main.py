"""FastAPI主入口"""

import asyncio
import json
import subprocess
import os
import uuid
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .core.port_scanner import get_all_listening_ports, guess_service_type, is_dangerous_port
from .core.process_info import get_process_detail, kill_process
from .core.conflict_detector import detect_conflicts, get_port_usage_stats
from .core.log_tailer import tail_file, find_log_files, read_log_tail

app = FastAPI(title="端口监控工具", version="1.0.0")


# 命令执行相关
class ExecRequest(BaseModel):
    command: str
    cwd: str = ""

active_execs: dict = {}  # exec_id -> {"process": subprocess, "cwd": str, "output": list}
recent_execs: list = []  # 最近的执行记录 [{"exec_id", "command", "cwd", "output", "started_at", "finished_at"}]

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket连接管理
active_connections: Set[WebSocket] = set()
active_tails: dict = {}


@app.get("/api/ports")
async def get_ports():
    """获取所有监听端口"""
    ports = get_all_listening_ports()
    # 添加服务类型推测和危险端口标记
    for port in ports:
        port['service_type'] = guess_service_type(port['process_name'], port['local_port'])
        port['is_dangerous'] = is_dangerous_port(port['local_port'], port['local_ip'], port['process_name'])
    return {"ports": ports, "count": len(ports)}


@app.get("/api/ports/conflicts")
async def get_port_conflicts():
    """获取端口冲突"""
    conflicts = detect_conflicts()
    return {"conflicts": conflicts, "count": len(conflicts)}


@app.get("/api/ports/stats")
async def get_port_stats():
    """获取端口统计"""
    stats = get_port_usage_stats()
    return stats


@app.get("/api/process/{pid}")
async def get_process(pid: int):
    """获取进程详情"""
    detail = get_process_detail(pid)
    if detail:
        # 添加可能的日志文件
        detail['log_files'] = find_log_files(pid)
        return detail
    return {"error": "进程不存在或无法访问"}


@app.post("/api/process/{pid}/kill")
async def kill_process_by_pid(pid: int):
    """终止进程"""
    result = kill_process(pid)
    # 通知所有WebSocket客户端
    await broadcast({"type": "process_killed", "pid": pid, **result})
    return result


@app.get("/api/process/{pid}/logs")
async def get_process_logs(pid: int, lines: int = 100):
    """获取进程日志文件内容"""
    log_files = find_log_files(pid)
    result = []
    for path in log_files[:5]:
        content = read_log_tail(path, lines)
        result.append({"path": path, "lines": content, "total_lines": len(content)})
    return {"pid": pid, "log_files": result}


@app.get("/api/directories")
async def get_directories():
    """获取系统中已知的工作目录列表"""
    dirs = set()
    ports = get_all_listening_ports()
    for p in ports:
        cwd = p.get('cwd', '')
        if cwd and cwd != '-':
            dirs.add(cwd)
    # 添加常见目录
    for d in ['C:\\', 'D:\\', 'C:\\Users', os.path.expanduser('~')]:
        if os.path.isdir(d):
            dirs.add(d)
    return {"directories": sorted(dirs)}


@app.get("/api/browse")
async def browse_directory(path: str = ""):
    """浏览目录，返回子目录列表"""
    if not path:
        # 列出所有盘符
        import string
        drives = []
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.isdir(drive):
                drives.append({"name": drive, "path": drive, "type": "drive"})
        return {"current": "", "directories": drives}

    if not os.path.isdir(path):
        return {"error": "路径不存在", "current": path, "directories": []}

    dirs = []
    try:
        for item in os.listdir(path):
            full = os.path.join(path, item)
            if os.path.isdir(full) and not item.startswith('.'):
                dirs.append({"name": item, "path": full, "type": "dir"})
    except PermissionError:
        return {"error": "无权访问", "current": path, "directories": []}

    # 排序：盘符优先，然后字母序
    dirs.sort(key=lambda d: (d["type"] != "drive", d["name"].lower()))

    # 添加上级目录按钮
    parent = os.path.dirname(path)
    if parent != path:
        dirs.insert(0, {"name": "..", "path": parent, "type": "parent"})

    return {"current": path, "directories": dirs}


@app.post("/api/exec")
async def exec_command(req: ExecRequest):
    """执行命令并返回执行ID用于流式读取"""
    exec_id = str(uuid.uuid4())[:8]
    cwd = req.cwd if req.cwd and os.path.isdir(req.cwd) else os.path.expanduser('~')

    # 写临时bat，命令输出重定向到日志文件
    import time, tempfile
    log_path = os.path.join(tempfile.gettempdir(), f'exec_{exec_id}.log')
    bat_path = os.path.join(tempfile.gettempdir(), f'exec_{exec_id}.bat')
    try:
        bat_content = f'@echo off\ncd /d "{cwd}"\n{req.command} > "{log_path}" 2>&1\n'
        with open(bat_path, 'w', encoding='gbk', errors='replace') as f:
            f.write(bat_content)
        proc = subprocess.Popen(
            [bat_path],
            cwd=cwd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        active_execs[exec_id] = {
            "process": proc, "cwd": cwd, "command": req.command,
            "started_at": time.time(), "output": [], "finished_at": None,
            "log_path": log_path,
        }
        return {"exec_id": exec_id, "cwd": cwd, "command": req.command}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/exec/{exec_id}/logs")
async def get_exec_logs(exec_id: str):
    """获取命令执行状态"""
    info = active_execs.get(exec_id)
    if not info:
        return {"error": "执行不存在"}

    proc = info["process"]
    poll = proc.poll()
    is_running = poll is None

    # 从日志文件读取输出
    log_path = info.get("log_path", "")
    lines = []
    if log_path and os.path.exists(log_path):
        try:
            with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
                lines = content.splitlines() if content.strip() else []
        except Exception:
            pass

    if not is_running and info.get("finished_at") is None:
        info["finished_at"] = time.time()
        recent_execs.insert(0, {
            "exec_id": exec_id,
            "command": info["command"],
            "cwd": info["cwd"],
            "output": lines,
            "started_at": info["started_at"],
            "finished_at": info["finished_at"],
            "return_code": poll,
        })
        if len(recent_execs) > 20:
            recent_execs.pop()

    return {
        "exec_id": exec_id,
        "lines": lines,
        "is_running": is_running,
        "return_code": poll,
        "cwd": info["cwd"],
        "command": info["command"],
        "started_at": info.get("started_at", 0),
    }


@app.post("/api/exec/{exec_id}/stop")
async def stop_exec(exec_id: str):
    """终止命令执行"""
    info = active_execs.get(exec_id)
    if not info:
        return {"error": "执行不存在"}

    proc = info["process"]
    try:
        proc.terminate()
        return {"success": True, "message": f"已终止进程"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/exec/recent")
async def get_recent_execs():
    """获取最近的命令执行记录"""
    # 同时收集仍在活跃的执行
    active = []
    for eid, info in active_execs.items():
        if info["process"].poll() is None:
            active.append({
                "exec_id": eid,
                "command": info["command"],
                "cwd": info["cwd"],
                "output": info["output"],
                "started_at": info["started_at"],
                "finished_at": None,
                "return_code": None,
            })
    return {"execs": active + recent_execs}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket连接 - 实时推送端口数据"""
    await websocket.accept()
    active_connections.add(websocket)

    try:
        # 启动定期推送任务
        async def push_ports():
            while True:
                try:
                    ports = get_all_listening_ports()
                    for port in ports:
                        port['service_type'] = guess_service_type(port['process_name'], port['local_port'])
                        port['is_dangerous'] = is_dangerous_port(port['local_port'], port['local_ip'], port['process_name'])

                    conflicts = detect_conflicts()

                    await websocket.send_json({
                        "type": "ports_update",
                        "data": ports,
                        "conflicts": conflicts,
                    })
                except Exception:
                    break
                await asyncio.sleep(2)

        push_task = asyncio.create_task(push_ports())

        # 监听客户端消息
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "tail_start":
                await start_tail(websocket, message)
            elif message.get("type") == "tail_stop":
                await stop_tail(websocket, message.get("pid"))

    except WebSocketDisconnect:
        pass
    finally:
        active_connections.discard(websocket)
        # 清理tail任务
        for pid in list(active_tails.keys()):
            if active_tails[pid].get("websocket") == websocket:
                await stop_tail(websocket, pid)


async def start_tail(websocket: WebSocket, message: dict):
    """开始tail日志"""
    pid = message.get("pid")
    file_path = message.get("file_path")

    if not file_path:
        # 尝试自动查找日志文件
        log_files = find_log_files(pid)
        if log_files:
            file_path = log_files[0]
        else:
            await websocket.send_json({
                "type": "log_error",
                "pid": pid,
                "message": "未找到日志文件，请指定文件路径"
            })
            return

    # 停止之前的tail
    await stop_tail(websocket, pid)

    async def tail_task():
        try:
            async for line in tail_file(file_path):
                await websocket.send_json({
                    "type": "log_line",
                    "pid": pid,
                    "line": line,
                })
        except asyncio.CancelledError:
            pass
        except Exception as e:
            await websocket.send_json({
                "type": "log_error",
                "pid": pid,
                "message": str(e)
            })

    task = asyncio.create_task(tail_task())
    active_tails[pid] = {
        "task": task,
        "websocket": websocket,
        "file_path": file_path,
    }

    await websocket.send_json({
        "type": "tail_started",
        "pid": pid,
        "file_path": file_path,
    })


async def stop_tail(websocket: WebSocket, pid: int):
    """停止tail日志"""
    if pid in active_tails:
        tail_info = active_tails[pid]
        if tail_info.get("websocket") == websocket:
            tail_info["task"].cancel()
            del active_tails[pid]


async def broadcast(message: dict):
    """广播消息到所有WebSocket连接"""
    for connection in active_connections.copy():
        try:
            await connection.send_json(message)
        except Exception:
            active_connections.discard(connection)
