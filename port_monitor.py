#!/usr/bin/env python3
"""
端口监控工具 - 实时显示电脑上运行的端口、服务和地址信息
"""

import subprocess
import re
import time
import sys
import os
from datetime import datetime


def get_port_info():
    """获取端口信息"""
    ports = []
    try:
        # 使用netstat获取端口信息
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True,
            encoding='gbk',
            errors='ignore'
        )

        for line in result.stdout.splitlines():
            # 跳过标题行和空行
            if not line.strip() or '协议' in line or '活动连接' in line:
                continue

            # 匹配TCP/UDP端口信息 - Windows格式: 协议  本地地址  外部地址  状态  PID
            parts = line.split()
            if len(parts) >= 4 and parts[0] in ['TCP', 'UDP']:
                protocol = parts[0]
                local_addr = parts[1]
                remote_addr = parts[2] if len(parts) > 2 else '-'
                state = parts[3] if len(parts) > 3 else '-'
                pid = parts[-1] if len(parts) > 4 else '-'

                # 解析本地地址和端口
                if ':' in local_addr:
                    local_ip, local_port = local_addr.rsplit(':', 1)
                else:
                    local_ip = local_addr
                    local_port = '0'

                # 获取进程名称
                process_name = get_process_name(pid)

                # 判断服务类型
                service_type = guess_service_type(process_name, local_port)

                ports.append({
                    'protocol': protocol,
                    'local_ip': local_ip,
                    'local_port': int(local_port),
                    'remote_addr': remote_addr,
                    'state': state,
                    'pid': pid,
                    'process': process_name,
                    'service': service_type
                })
    except Exception as e:
        print(f"获取端口信息时出错: {e}")

    return ports


def get_process_name(pid):
    """根据PID获取进程名称"""
    try:
        result = subprocess.run(
            ['tasklist', '/FI', f'PID eq {pid}', '/FO', 'CSV', '/NH'],
            capture_output=True,
            text=True,
            encoding='gbk',
            errors='ignore'
        )

        for line in result.stdout.splitlines():
            if line.strip():
                # 解析CSV格式输出
                parts = line.strip().split(',')
                if len(parts) >= 1:
                    # 移除引号
                    name = parts[0].strip('"')
                    return name
    except:
        pass
    return f'PID:{pid}'


def guess_service_type(process_name, port):
    """根据进程名和端口号猜测服务类型"""
    process_lower = process_name.lower()
    port_num = int(port)

    # 常见服务映射
    known_services = {
        135: 'RPC',
        137: 'NetBIOS',
        138: 'NetBIOS',
        139: 'NetBIOS',
        445: 'SMB',
        3306: 'MySQL',
        5432: 'PostgreSQL',
        6379: 'Redis',
        27017: 'MongoDB',
        8080: 'HTTP-Alt',
        8443: 'HTTPS-Alt',
    }

    # 进程名到服务类型的映射
    process_services = {
        'svchost': 'System Service',
        'system': 'System',
        'lsass': 'Security',
        'wininit': 'System Init',
        'dcom': 'DCOM',
        'spoolsv': 'Print Spooler',
        'weixin': 'WeChat',
        'wechat': 'WeChat',
        'wechatdevtools': 'WeChat DevTools',
        'dingtalk': 'DingTalk',
        'alibaba': 'Alibaba',
        'taobao': 'Taobao',
        'cloudmusic': 'NetEase Music',
        'onedrive': 'OneDrive',
        'wps': 'WPS Office',
        'wpscloudsvr': 'WPS Cloud',
        'adb': 'Android Debug',
        'chrome': 'Chrome Browser',
        'firefox': 'Firefox Browser',
        'edge': 'Edge Browser',
        'explorer': 'File Explorer',
        'code': 'VS Code',
        'node': 'Node.js',
        'npm': 'Node.js',
        'python': 'Python',
        'java': 'Java',
        'javaw': 'Java',
        'docker': 'Docker',
        'mysql': 'MySQL',
        'mariadb': 'MariaDB',
        'postgres': 'PostgreSQL',
        'redis': 'Redis',
        'mongo': 'MongoDB',
        'nginx': 'Nginx',
        'apache': 'Apache',
        'http': 'HTTP Server',
        'iis': 'IIS',
        'w3wp': 'IIS Worker',
        'sqlservr': 'SQL Server',
        'oracle': 'Oracle',
    }

    # 根据进程名猜测
    for key, service in process_services.items():
        if key in process_lower:
            return service

    # 根据端口号猜测
    if port_num in known_services:
        return known_services[port_num]

    return 'Other'


def clear_screen():
    """清屏"""
    os.system('cls' if os.name == 'nt' else 'clear')


def print_table(ports):
    """打印端口信息表格"""
    clear_screen()

    print("=" * 100)
    print(f"{'端口监控工具':^100}")
    print(f"{'实时监控 - 按 Ctrl+C 退出':^100}")
    print(f"{'更新时间: ' + datetime.now().strftime('%Y-%m-%d %H:%M:%S'):^100}")
    print("=" * 100)

    # 过滤只显示监听中的端口
    listening_ports = [p for p in ports if p['state'] in ['LISTENING', 'LISTEN']]

    if not listening_ports:
        print("\n没有找到监听中的端口\n")
        return

    # 按端口号排序
    listening_ports.sort(key=lambda x: x['local_port'])

    # 打印表头
    print(f"\n{'序号':<5} {'协议':<6} {'本地地址':<22} {'端口':<8} {'进程ID':<8} {'进程名':<20} {'服务类型':<15}")
    print("-" * 100)

    # 打印数据
    for i, port in enumerate(listening_ports[:30], 1):  # 最多显示30条
        local_addr = f"{port['local_ip']}:{port['local_port']}"
        print(f"{i:<5} {port['protocol']:<6} {local_addr:<22} {port['local_port']:<8} {port['pid']:<8} {port['process']:<20} {port['service']:<15}")

    if len(listening_ports) > 30:
        print(f"\n... 还有 {len(listening_ports) - 30} 个端口未显示")

    print(f"\n共找到 {len(listening_ports)} 个监听中的端口")
    print("=" * 100)


def main():
    """主函数"""
    print("端口监控工具启动中...")
    print("按 Ctrl+C 退出\n")

    try:
        while True:
            ports = get_port_info()
            print_table(ports)
            time.sleep(2)  # 每2秒刷新一次
    except KeyboardInterrupt:
        print("\n\n监控已停止")


if __name__ == '__main__':
    main()
