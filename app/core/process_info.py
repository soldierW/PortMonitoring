"""进程信息模块 - 获取和操作进程"""

import psutil
import os
from typing import Dict, Any, Optional


def get_process_detail(pid: int) -> Optional[Dict[str, Any]]:
    """获取进程详细信息"""
    try:
        proc = psutil.Process(pid)
        with proc.oneshot():
            info = {
                'pid': pid,
                'name': proc.name(),
                'status': proc.status(),
                'create_time': proc.create_time(),
                'cpu_percent': proc.cpu_percent(interval=0),
                'memory_mb': round(proc.memory_info().rss / (1024 * 1024), 1),
                'memory_percent': round(proc.memory_percent(), 1),
            }

            try:
                info['cmdline'] = proc.cmdline()
            except (psutil.AccessDenied, psutil.ZombieProcess):
                info['cmdline'] = []

            try:
                info['cwd'] = proc.cwd()
            except (psutil.AccessDenied, psutil.ZombieProcess):
                info['cwd'] = ''

            try:
                info['exe'] = proc.exe()
            except (psutil.AccessDenied, psutil.ZombieProcess):
                info['exe'] = ''

            try:
                info['username'] = proc.username()
            except (psutil.AccessDenied, psutil.ZombieProcess):
                info['username'] = ''

            try:
                info['threads'] = proc.num_threads()
            except (psutil.AccessDenied, psutil.ZombieProcess):
                info['threads'] = 0

            try:
                info['open_files'] = len(proc.open_files())
            except (psutil.AccessDenied, psutil.ZombieProcess):
                info['open_files'] = 0

            try:
                info['connections'] = len(proc.connections())
            except (psutil.AccessDenied, psutil.ZombieProcess):
                info['connections'] = 0

        return info
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return None


def kill_process(pid: int) -> Dict[str, Any]:
    """终止进程"""
    try:
        proc = psutil.Process(pid)
        proc.kill()
        return {'success': True, 'message': f'进程 {pid} 已终止'}
    except psutil.NoSuchProcess:
        return {'success': False, 'message': f'进程 {pid} 不存在'}
    except psutil.AccessDenied:
        return {'success': False, 'message': f'没有权限终止进程 {pid}'}
    except Exception as e:
        return {'success': False, 'message': f'终止进程失败: {str(e)}'}


def get_process_tree(pid: int) -> Optional[Dict[str, Any]]:
    """获取进程树"""
    try:
        proc = psutil.Process(pid)
        tree = {
            'pid': pid,
            'name': proc.name(),
            'children': []
        }

        for child in proc.children(recursive=True):
            tree['children'].append({
                'pid': child.pid,
                'name': child.name(),
            })

        return tree
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None
