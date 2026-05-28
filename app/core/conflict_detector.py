"""端口冲突检测模块"""

from collections import defaultdict
from typing import List, Dict, Any
from .port_scanner import get_all_listening_ports


def detect_conflicts() -> List[Dict[str, Any]]:
    """检测端口冲突 - 同一端口被多个进程监听"""
    ports = get_all_listening_ports()

    port_map = defaultdict(list)
    for port_info in ports:
        key = (port_info['local_ip'], port_info['local_port'])
        port_map[key].append(port_info)

    conflicts = []
    for key, procs in port_map.items():
        if len(procs) > 1:
            conflicts.append({
                'ip': key[0],
                'port': key[1],
                'address': f"{key[0]}:{key[1]}",
                'processes': [
                    {
                        'pid': p['pid'],
                        'name': p['process_name'],
                        'cmdline': p['cmdline'],
                    }
                    for p in procs
                ],
                'count': len(procs),
            })

    return sorted(conflicts, key=lambda x: x['port'])


def get_port_usage_stats() -> Dict[str, Any]:
    """获取端口使用统计"""
    ports = get_all_listening_ports()

    stats = {
        'total_ports': len(ports),
        'tcp_count': sum(1 for p in ports if p['protocol'] == 'TCP'),
        'udp_count': sum(1 for p in ports if p['protocol'] == 'UDP'),
        'unique_processes': len(set(p['pid'] for p in ports if p['pid'])),
        'top_ports': _get_top_ports(ports),
    }

    return stats


def _get_top_ports(ports: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    """获取占用端口最多的进程"""
    pid_count = defaultdict(int)
    pid_name = {}

    for port in ports:
        if port['pid']:
            pid_count[port['pid']] += 1
            pid_name[port['pid']] = port['process_name']

    sorted_pids = sorted(pid_count.items(), key=lambda x: x[1], reverse=True)[:limit]

    return [
        {
            'pid': pid,
            'name': pid_name.get(pid, 'Unknown'),
            'port_count': count,
        }
        for pid, count in sorted_pids
    ]
