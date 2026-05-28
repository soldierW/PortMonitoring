"""日志tail模块 - 异步读取日志文件"""

import asyncio
import os
from typing import AsyncGenerator, Optional


async def tail_file(file_path: str, lines: int = 100) -> AsyncGenerator[str, None]:
    """异步tail文件，先返回最后N行，然后持续监听新内容"""
    if not os.path.exists(file_path):
        yield f"[ERROR] 文件不存在: {file_path}\n"
        return

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            # 先读取最后N行
            all_lines = f.readlines()
            start_line = max(0, len(all_lines) - lines)
            for line in all_lines[start_line:]:
                yield line.rstrip('\n')

            # 持续监听新内容
            while True:
                line = f.readline()
                if line:
                    yield line.rstrip('\n')
                else:
                    await asyncio.sleep(0.1)
    except Exception as e:
        yield f"[ERROR] 读取文件失败: {str(e)}\n"


async def tail_file_with_history(file_path: str, history_lines: int = 100) -> AsyncGenerator[str, None]:
    """tail文件，带历史记录"""
    if not os.path.exists(file_path):
        yield f"[ERROR] 文件不存在: {file_path}\n"
        return

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            # 读取历史记录
            all_lines = f.readlines()
            start_line = max(0, len(all_lines) - history_lines)
            for line in all_lines[start_line:]:
                yield line.rstrip('\n')

            # 持续监听
            while True:
                line = f.readline()
                if line:
                    yield line.rstrip('\n')
                else:
                    await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        return
    except Exception as e:
        yield f"[ERROR] 读取文件失败: {str(e)}\n"


def find_log_files(pid: int) -> list:
    """尝试查找进程相关的日志文件"""
    import psutil

    log_files = []

    try:
        proc = psutil.Process(pid)
        cmdline = proc.cmdline()
        cwd = proc.cwd()

        # 从cmdline推断日志文件
        for arg in cmdline:
            if '--log-file=' in arg:
                log_path = arg.split('=', 1)[1]
                if os.path.exists(log_path):
                    log_files.append(log_path)
            elif '--logfile=' in arg:
                log_path = arg.split('=', 1)[1]
                if os.path.exists(log_path):
                    log_files.append(log_path)
            elif arg.endswith('.log') and os.path.exists(arg):
                log_files.append(arg)

        # 检查常见日志位置
        if cwd and os.path.exists(cwd):
            common_log_names = [
                'logs/app.log', 'logs/error.log', 'logs/output.log', 'logs/debug.log',
                'logs/server.log', 'logs/access.log',
                'app.log', 'error.log', 'output.log', 'server.log', 'debug.log',
                'access.log', 'startup.log',
            ]
            for name in common_log_names:
                path = os.path.join(cwd, name)
                if os.path.exists(path):
                    log_files.append(path)

            # 递归搜索logs目录下的.log文件(最多2层)
            logs_dir = os.path.join(cwd, 'logs')
            if os.path.isdir(logs_dir):
                for root, dirs, files in os.walk(logs_dir):
                    depth = root.replace(logs_dir, '').count(os.sep)
                    if depth >= 2:
                        dirs.clear()
                        continue
                    for f in files:
                        if f.endswith('.log'):
                            full = os.path.join(root, f)
                            if full not in log_files:
                                log_files.append(full)

    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

    return log_files


def read_log_tail(file_path: str, lines: int = 100) -> list:
    """读取日志文件最后N行"""
    if not os.path.exists(file_path):
        return [f"[ERROR] 文件不存在: {file_path}"]
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            all_lines = f.readlines()
            start = max(0, len(all_lines) - lines)
            return [line.rstrip('\n') for line in all_lines[start:]]
    except Exception as e:
        return [f"[ERROR] 读取失败: {e}"]
