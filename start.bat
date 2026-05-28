@echo off
chcp 65001 >nul 2>&1
title PortMonitor

echo ========================================
echo    PortMonitor
echo ========================================
echo.

:: Kill existing processes on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Killing process %%a on port 8000...
    taskkill /F /PID %%a >nul 2>&1
)

echo Starting backend and frontend...

:: 使用 pythonw 运行后端，进程完全脱离控制台，关闭窗口后继续运行
start "" /b pythonw -m uvicorn app.main:app --host 0.0.0.0 --port 8000

:: 前端也脱离控制台
start "" /b cmd /c "cd /d D:\wj\PortMonitoring\web && npm run dev"

timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5173
echo  Press any key to stop all services
echo ========================================
echo.
pause >nul

:: Cleanup by port
echo Stopping services...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo Done.
