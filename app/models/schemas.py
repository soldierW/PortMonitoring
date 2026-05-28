"""Pydantic数据模型"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class PortInfo(BaseModel):
    """端口信息模型"""
    protocol: str
    local_ip: str
    local_port: int
    remote_addr: str = '-'
    status: str
    pid: Optional[int] = None
    fd: int = 0
    process_name: str = '-'
    cmdline: str = '-'
    cwd: str = '-'
    exe: str = '-'
    cpu_percent: float = 0
    memory_mb: float = 0


class ProcessDetail(BaseModel):
    """进程详情模型"""
    pid: int
    name: str
    status: str
    create_time: float
    cpu_percent: float
    memory_mb: float
    memory_percent: float
    cmdline: List[str] = []
    cwd: str = ''
    exe: str = ''
    username: str = ''
    threads: int = 0
    open_files: int = 0
    connections: int = 0


class ConflictInfo(BaseModel):
    """端口冲突信息模型"""
    ip: str
    port: int
    address: str
    processes: List[Dict[str, Any]]
    count: int


class PortStats(BaseModel):
    """端口统计模型"""
    total_ports: int
    tcp_count: int
    udp_count: int
    unique_processes: int
    top_ports: List[Dict[str, Any]]


class KillProcessRequest(BaseModel):
    """终止进程请求"""
    pid: int


class KillProcessResponse(BaseModel):
    """终止进程响应"""
    success: bool
    message: str


class TailLogRequest(BaseModel):
    """日志tail请求"""
    pid: int
    file_path: str
    history_lines: int = 100
