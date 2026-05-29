# 端口监控工具

实时监控电脑上运行的端口、进程信息、启动命令、工作目录等。

## 功能特点

- 实时显示正在监听的端口
- 显示协议类型（TCP/UDP）
- 显示本地地址和端口
- 显示进程ID、进程名称、启动命令、工作目录
- 自动推测服务类型（如 Nginx、Node.js、Python 等）
- 端口冲突检测
- 一键终止进程
- 实时日志 tail 功能
- 深色/浅色主题切换
- WebSocket 实时更新
- 适用使用windows server的运维人员
  
## 快速开始

### 方式一：使用启动脚本（推荐）

双击运行 `start.bat` 即可启动前后端服务。

### 方式二：手动启动

1. 启动后端：
```bash
cd D:/wj/PortMonitoring
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

2. 启动前端：
```bash
cd D:/wj/PortMonitoring/web
npm run dev
```

3. 打开浏览器访问：http://localhost:5173

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | FastAPI + uvicorn |
| 系统信息 | psutil |
| 前端 | React + Ant Design |
| 实时通信 | WebSocket |

## API 文档

启动后端后访问：http://localhost:8000/docs

## 项目结构

```
D:/wj/PortMonitoring/
├── app/                          # 后端Python
│   ├── main.py                   # FastAPI入口
│   ├── core/
│   │   ├── port_scanner.py       # 端口扫描
│   │   ├── process_info.py       # 进程信息
│   │   ├── conflict_detector.py  # 冲突检测
│   │   └── log_tailer.py         # 日志tail
│   └── models/
│       └── schemas.py            # 数据模型
├── web/                          # 前端React
│   └── src/
│       ├── App.jsx               # 主组件
│       ├── components/           # UI组件
│       ├── hooks/                # 自定义Hook
│       └── services/             # API服务
├── requirements.txt              # Python依赖
└── start.bat                     # 启动脚本
```

## 依赖安装

### Python 依赖
```bash
pip install -r requirements.txt
```

### Node.js 依赖
```bash
cd web
npm install
```
