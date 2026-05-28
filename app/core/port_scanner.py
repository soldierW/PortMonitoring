"""端口扫描模块 - 使用psutil获取网络连接信息"""

import psutil
import socket
from typing import List, Dict, Any


def get_all_listening_ports() -> List[Dict[str, Any]]:
    """获取所有监听中的端口信息"""
    ports = []

    try:
        connections = psutil.net_connections(kind='inet')
    except psutil.AccessDenied:
        return ports

    for conn in connections:
        if conn.status != psutil.CONN_LISTEN:
            continue

        pid = conn.pid
        proc_info = _get_process_info(pid)

        ports.append({
            'protocol': 'TCP' if conn.type == socket.SOCK_STREAM else 'UDP',
            'local_ip': conn.laddr.ip if conn.laddr else '0.0.0.0',
            'local_port': conn.laddr.port if conn.laddr else 0,
            'remote_addr': f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else '-',
            'status': conn.status,
            'pid': pid,
            'fd': conn.fd,
            **proc_info
        })

    return sorted(ports, key=lambda x: x['local_port'])


def _get_process_info(pid: int) -> Dict[str, Any]:
    """获取进程详细信息"""
    if not pid:
        return {
            'process_name': '-',
            'cmdline': '-',
            'cwd': '-',
            'exe': '-',
            'cpu_percent': 0,
            'memory_mb': 0,
        }

    try:
        proc = psutil.Process(pid)
        with proc.oneshot():
            name = proc.name()
            try:
                cmdline = ' '.join(proc.cmdline())
            except (psutil.AccessDenied, psutil.ZombieProcess):
                cmdline = '-'
            try:
                cwd = proc.cwd()
            except (psutil.AccessDenied, psutil.ZombieProcess):
                cwd = '-'
            try:
                exe = proc.exe()
            except (psutil.AccessDenied, psutil.ZombieProcess):
                exe = '-'
            try:
                cpu = proc.cpu_percent(interval=0)
            except (psutil.AccessDenied, psutil.ZombieProcess):
                cpu = 0
            try:
                mem = proc.memory_info().rss / (1024 * 1024)
            except (psutil.AccessDenied, psutil.ZombieProcess):
                mem = 0

        return {
            'process_name': name,
            'cmdline': cmdline,
            'cwd': cwd,
            'exe': exe,
            'cpu_percent': round(cpu, 1),
            'memory_mb': round(mem, 1),
        }
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return {
            'process_name': f'PID:{pid}',
            'cmdline': '-',
            'cwd': '-',
            'exe': '-',
            'cpu_percent': 0,
            'memory_mb': 0,
        }


DANGEROUS_PORTS = {
    21: 'FTP',
    22: 'SSH',
    23: 'Telnet',
    25: 'SMTP',
    110: 'POP3',
    135: 'NetBIOS',
    137: 'NetBIOS',
    138: 'NetBIOS',
    139: 'NetBIOS',
    143: 'IMAP',
    445: 'SMB',
    1433: 'MSSQL',
    1434: 'MSSQL',
    3306: 'MySQL',
    3389: 'RDP',
    5432: 'PostgreSQL',
    5900: 'VNC',
    6379: 'Redis',
    27017: 'MongoDB',
}

DATABASE_PORTS = {3306, 5432, 1433, 1434, 6379, 27017, 25565}


def is_dangerous_port(port: int, local_ip: str, process_name: str) -> bool:
    """判断端口是否为危险端口"""
    if port in DANGEROUS_PORTS:
        if port in DATABASE_PORTS and local_ip not in ('0.0.0.0', '::', ''):
            return False
        return True
    return False


def guess_service_type(process_name: str, port: int) -> str:
    """根据进程名和端口号推测服务类型"""
    name_lower = process_name.lower()

    # 进程名匹配
    process_services = {
        'nginx': 'Nginx',
        'apache': 'Apache',
        'httpd': 'Apache',
        'node': 'Node.js',
        'npm': 'Node.js',
        'vite': 'Vite',
        'python': 'Python',
        'java': 'Java',
        'javaw': 'Java',
        'docker': 'Docker',
        'mysql': 'MySQL',
        'mariadb': 'MariaDB',
        'postgres': 'PostgreSQL',
        'redis': 'Redis',
        'mongo': 'MongoDB',
        'iis': 'IIS',
        'w3wp': 'IIS',
        'sqlservr': 'SQL Server',
        'memcached': 'Memcached',
        'tomcat': 'Tomcat',
        'php-cgi': 'PHP',
        'php': 'PHP',
    }

    for key, service in process_services.items():
        if key in name_lower:
            return service

    # 端口号匹配
    port_services = {
        80: 'HTTP',
        443: 'HTTPS',
        3000: 'Dev Server',
        5000: 'Dev Server',
        8000: 'Dev Server',
        8080: 'HTTP Alt',
        8443: 'HTTPS Alt',
        3306: 'MySQL',
        5432: 'PostgreSQL',
        6379: 'Redis',
        27017: 'MongoDB',
    }

    return port_services.get(port, 'Service')
