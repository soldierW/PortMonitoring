import { useEffect, useRef, useState } from 'react';
import { Drawer, Input, Button, Space, Typography, Alert } from 'antd';
import { ClearOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function LogViewer({ visible, pid, onClose, onSendMessage }) {
  const [logs, setLogs] = useState([]);
  const [filePath, setFilePath] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (visible && pid) {
      setLogs([]);
      setIsStreaming(false);
    }
  }, [visible, pid]);

  useEffect(() => {
    // 自动滚动到底部
    if (logContainerRef.current && !isPaused) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  // 处理WebSocket消息
  useEffect(() => {
    const handleLogMessage = (event) => {
      const data = event.detail;
      if (data.type === 'log_line' && data.pid === pid) {
        setLogs(prev => [...prev, { text: data.line, type: 'info' }]);
      } else if (data.type === 'log_error' && data.pid === pid) {
        setLogs(prev => [...prev, { text: data.message, type: 'error' }]);
      } else if (data.type === 'tail_started' && data.pid === pid) {
        setIsStreaming(true);
        setFilePath(data.file_path);
      }
    };

    window.addEventListener('log_message', handleLogMessage);
    return () => window.removeEventListener('log_message', handleLogMessage);
  }, [pid]);

  const handleStartTail = () => {
    if (!filePath) return;
    onSendMessage({
      type: 'tail_start',
      pid,
      file_path: filePath,
    });
    setIsStreaming(true);
  };

  const handleStopTail = () => {
    onSendMessage({
      type: 'tail_stop',
      pid,
    });
    setIsStreaming(false);
  };

  const handleClear = () => {
    setLogs([]);
  };

  return (
    <Drawer
      title={
        <Space>
          <span>日志查看器</span>
          <Text type="secondary">PID: {pid}</Text>
          {isStreaming && <Alert message="实时监控中" type="success" showIcon style={{ padding: '0 8px' }} />}
        </Space>
      }
      placement="bottom"
      height={400}
      open={visible}
      onClose={onClose}
      extra={
        <Space>
          <Input
            placeholder="日志文件路径"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            style={{ width: 400 }}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              icon={<PauseCircleOutlined />}
              onClick={handleStopTail}
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartTail}
              disabled={!filePath}
            >
              开始监控
            </Button>
          )}
          <Button
            icon={<ClearOutlined />}
            onClick={handleClear}
          >
            清空
          </Button>
        </Space>
      }
    >
      <div
        ref={logContainerRef}
        style={{
          height: 300,
          overflow: 'auto',
          background: '#1e1e1e',
          padding: 12,
          fontFamily: 'Consolas, Monaco, monospace',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', marginTop: 100 }}>
            请输入日志文件路径并点击"开始监控"
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                color: log.type === 'error' ? '#ff4d4f' : '#d4d4d4',
              }}
            >
              {log.text}
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
