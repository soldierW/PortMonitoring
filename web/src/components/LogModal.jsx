import { useEffect, useRef, useState } from 'react';
import { Modal, Spin, Empty, Tag, Space, Button, Tabs } from 'antd';
import { PauseCircleOutlined, PlayCircleOutlined, ClearOutlined, CodeOutlined } from '@ant-design/icons';

export default function LogModal({ visible, port, onClose, onSendMessage }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeFile, setActiveFile] = useState(null);
  const [activeTab, setActiveTab] = useState('logs');
  const [execLogs, setExecLogs] = useState([]);
  const [execLoading, setExecLoading] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (visible && port) {
      setLogs([]);
      setIsStreaming(false);
      setActiveFile(null);
      setActiveTab('logs');
      loadLogs(port.pid);
      loadExecLogs();
    }
  }, [visible, port]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, execLogs]);

  // 命令输出标签页自动刷新
  useEffect(() => {
    if (!visible || activeTab !== 'exec') return;
    const timer = setInterval(() => {
      loadExecLogs();
    }, 2000);
    return () => clearInterval(timer);
  }, [visible, activeTab]);

  // WebSocket log messages
  useEffect(() => {
    const handler = (event) => {
      const data = event.detail;
      if (data.type === 'log_line' && data.pid === port?.pid) {
        setLogs(prev => [...prev, { text: data.line, type: 'info' }]);
      } else if (data.type === 'log_error' && data.pid === port?.pid) {
        setLogs(prev => [...prev, { text: data.message, type: 'error' }]);
      } else if (data.type === 'tail_started' && data.pid === port?.pid) {
        setIsStreaming(true);
      }
    };
    window.addEventListener('log_message', handler);
    return () => window.removeEventListener('log_message', handler);
  }, [port?.pid]);

  const loadLogs = async (pid) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/process/${pid}/logs?lines=200`);
      const data = await resp.json();
      const allLines = [];
      for (const file of (data.log_files || [])) {
        allLines.push({ text: `--- ${file.path} ---`, type: 'header' });
        for (const line of file.lines) {
          allLines.push({ text: line, type: 'info' });
        }
      }
      if (allLines.length === 0) {
        allLines.push({ text: '未找到日志文件', type: 'header' });
      }
      setLogs(allLines);
    } catch (e) {
      setLogs([{ text: `加载失败: ${e.message}`, type: 'error' }]);
    } finally {
      setLoading(false);
    }
  };

  const loadExecLogs = async () => {
    setExecLoading(true);
    try {
      const resp = await fetch('/api/exec/recent');
      const data = await resp.json();
      setExecLogs(data.execs || []);
    } catch (e) {
      console.error('Failed to load exec logs:', e);
    } finally {
      setExecLoading(false);
    }
  };

  const handleStartTail = (filePath) => {
    setActiveFile(filePath);
    setLogs(prev => [...prev, { text: `>>> 开始监控: ${filePath}`, type: 'header' }]);
    onSendMessage({ type: 'tail_start', pid: port.pid, file_path: filePath });
  };

  const handleStopTail = () => {
    onSendMessage({ type: 'tail_stop', pid: port.pid });
    setIsStreaming(false);
    setActiveFile(null);
  };

  const renderLogContent = () => (
    <div
      ref={logRef}
      style={{
        height: 450,
        overflow: 'auto',
        background: '#0a0e14',
        padding: 12,
        fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
        fontSize: 12,
        lineHeight: 1.6,
        borderRadius: 6,
        border: '1px solid #1e293b',
      }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : logs.length === 0 ? (
        <Empty
          description={<span style={{ color: '#475569' }}>暂无日志</span>}
          style={{ marginTop: 100 }}
        />
      ) : (
        logs.map((log, i) => (
          <div
            key={i}
            style={{
              color: log.type === 'error' ? '#ff4d4f' : log.type === 'header' ? '#00d4ff' : '#94a3b8',
              fontWeight: log.type === 'header' ? 600 : 400,
              borderBottom: log.type === 'header' ? '1px solid #1e293b' : undefined,
              padding: log.type === 'header' ? '4px 0' : undefined,
              marginBottom: log.type === 'header' ? 4 : undefined,
            }}
          >
            {log.text}
          </div>
        ))
      )}
    </div>
  );

  const renderExecContent = () => (
    <div
      style={{
        height: 450,
        overflow: 'auto',
        background: '#0a0e14',
        padding: 12,
        fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
        fontSize: 12,
        lineHeight: 1.6,
        borderRadius: 6,
        border: '1px solid #1e293b',
      }}
    >
      {execLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : execLogs.length === 0 ? (
        <Empty
          description={<span style={{ color: '#475569' }}>暂无命令执行记录</span>}
          style={{ marginTop: 100 }}
        />
      ) : (
        execLogs.map((exec) => (
          <div key={exec.exec_id} style={{ marginBottom: 16 }}>
            <div style={{
              color: '#00d4ff',
              fontWeight: 600,
              borderBottom: '1px solid #1e293b',
              padding: '4px 0',
              marginBottom: 4,
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>{exec.command}</span>
              <Tag color={exec.return_code === null ? 'processing' : exec.return_code === 0 ? 'success' : 'error'} style={{ margin: 0 }}>
                {exec.return_code === null ? '运行中' : exec.return_code === 0 ? '成功' : `退出码 ${exec.return_code}`}
              </Tag>
            </div>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>
              目录: {exec.cwd}
            </div>
            {(exec.output || []).map((line, i) => (
              <div key={i} style={{
                color: line.toLowerCase().includes('error') ? '#ff4d4f' : '#94a3b8',
              }}>
                {line}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <Modal
      title={
        <Space>
          <span>日志</span>
          {port && (
            <>
              <Tag color="blue">{port.process_name}</Tag>
              <Tag>: {port.local_port}</Tag>
            </>
          )}
          {isStreaming && (
            <Tag color="green" style={{ animation: 'blink 1.5s infinite' }}>LIVE</Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={
        activeTab === 'logs' ? (
          <Space>
            {isStreaming ? (
              <Button icon={<PauseCircleOutlined />} onClick={handleStopTail}>
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => port && handleStartTail(activeFile || '')}
                disabled={!port}
              >
                实时监控
              </Button>
            )}
            <Button icon={<ClearOutlined />} onClick={() => setLogs([])}>
              清空
            </Button>
          </Space>
        ) : (
          <Space>
            <Button icon={<CodeOutlined />} onClick={loadExecLogs}>
              刷新
            </Button>
          </Space>
        )
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'logs',
            label: '进程日志',
            children: renderLogContent(),
          },
          {
            key: 'exec',
            label: '命令输出',
            children: renderExecContent(),
          },
        ]}
      />
    </Modal>
  );
}
