import { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, Card, Row, Col, Statistic, Badge, Button, Space, Typography, Modal, ConfigProvider, theme, message } from 'antd';
import {
  ReloadOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  HddOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useWebSocket } from './hooks/useWebSocket';
import { getPorts, getProcessDetail, killProcess } from './services/api';
import PortTable from './components/PortTable';
import ProcessDetail from './components/ProcessDetail';
import LogModal from './components/LogModal';
import CommandExecutor from './components/CommandExecutor';
import ConflictAlert from './components/ConflictAlert';
import ThemeToggle from './components/ThemeToggle';

const { Header, Content } = Layout;
const { Text } = Typography;

function App() {
  const [ports, setPorts] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPort, setSelectedPort] = useState(null);
  const [processDetail, setProcessDetail] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [logModalPort, setLogModalPort] = useState(null);
  const [isDark, setIsDark] = useState(true);
  const [filterDangerous, setFilterDangerous] = useState(false);
  const [execVisible, setExecVisible] = useState(false);
  const [highlightPort, setHighlightPort] = useState(null);
  const highlightTimer = useRef(null);

  const { isConnected, lastMessage, sendMessage } = useWebSocket(
    `ws://${window.location.hostname}:8000/ws`
  );

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'ports_update') {
      setPorts(lastMessage.data || []);
      setConflicts(lastMessage.conflicts || []);
    }

    if (['log_line', 'log_error', 'tail_started'].includes(lastMessage.type)) {
      window.dispatchEvent(new CustomEvent('log_message', { detail: lastMessage }));
    }

    if (lastMessage.type === 'process_killed') {
      setDetailVisible(false);
      setSelectedPort(null);
      setProcessDetail(null);
    }
  }, [lastMessage]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPorts();
      setPorts(data.ports || []);
    } catch (e) {
      console.error('Failed to load ports:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectPort = useCallback(async (record) => {
    setSelectedPort(record);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const detail = await getProcessDetail(record.pid);
      setProcessDetail(detail);
    } catch (e) {
      console.error('Failed to load process detail:', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleKill = useCallback(async (pid) => {
    Modal.confirm({
      title: '确认终止进程',
      content: `确定要终止 PID ${pid} 的进程吗？此操作不可撤销。`,
      okText: '终止',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await killProcess(pid);
        } catch (e) {
          console.error('Failed to kill process:', e);
        }
      },
    });
  }, []);

  const handleViewLogs = useCallback((record) => {
    setLogModalPort(record);
    setLogModalVisible(true);
  }, []);

  const handleExecSuccess = useCallback((newPort) => {
    // 高亮新端口行
    setHighlightPort(newPort);
    // 3秒后清除高亮
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightPort(null), 5000);
    // 滚动到该行
    setTimeout(() => {
      const row = document.querySelector(`[data-row-key="${newPort.pid}-${newPort.local_port}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    // 自动打开日志窗口
    setTimeout(() => {
      handleViewLogs(newPort);
    }, 600);
  }, [handleViewLogs]);

  const dangerousCount = ports.filter(p => p.is_dangerous).length;
  const filteredPorts = filterDangerous ? ports.filter(p => p.is_dangerous) : ports;

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#00d4ff',
          borderRadius: 6,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', background: isDark ? '#0a0e14' : '#f0f2f5' }}>
        <Header
          style={{
            background: isDark ? '#0f1419' : '#fff',
            borderBottom: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}`,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 56,
          }}
        >
          <Space size="middle">
            <Space size="small">
              <ApiOutlined style={{ color: '#00d4ff', fontSize: 20 }} />
              <Text strong style={{ color: isDark ? '#e2e8f0' : '#1a1a1a', fontSize: 16 }}>
                PortMonitor
              </Text>
            </Space>
            <Badge
              status={isConnected ? 'success' : 'error'}
              text={
                <Text style={{ color: isDark ? '#64748b' : '#999', fontSize: 12 }}>
                  {isConnected ? '已连接' : '断开'}
                </Text>
              }
            />
          </Space>

          <Space size="middle">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              size="small"
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => setExecVisible(true)}
              size="small"
            >
              执行命令
            </Button>
            <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
          </Space>
        </Header>

        <Content style={{ padding: '16px 24px' }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}>
              <Card size="small" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}` }}>
                <Statistic title="总端口" value={ports.length} prefix={<HddOutlined style={{ color: '#00d4ff' }} />} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}` }}>
                <Statistic title="TCP" value={ports.filter(p => p.protocol === 'TCP').length} prefix={<LinkOutlined style={{ color: '#3b82f6' }} />} valueStyle={{ color: '#3b82f6' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}` }}>
                <Statistic title="UDP" value={ports.filter(p => p.protocol === 'UDP').length} prefix={<ThunderboltOutlined style={{ color: '#f59e0b' }} />} valueStyle={{ color: '#f59e0b' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}` }}>
                <Statistic title="进程数" value={new Set(ports.map(p => p.pid).filter(Boolean)).size} prefix={<HddOutlined style={{ color: '#10b981' }} />} valueStyle={{ color: '#10b981' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card
                size="small"
                style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}`, cursor: 'pointer', borderColor: filterDangerous ? '#ff4d4f' : undefined }}
                onClick={() => setFilterDangerous(!filterDangerous)}
              >
                <Statistic title="危险端口" value={dangerousCount} prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />} valueStyle={{ color: '#ff4d4f' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}` }}>
                <Statistic title="冲突" value={conflicts.length} prefix={<WarningOutlined style={{ color: '#f59e0b' }} />} valueStyle={{ color: conflicts.length > 0 ? '#f59e0b' : undefined }} />
              </Card>
            </Col>
          </Row>

          <ConflictAlert conflicts={conflicts} />

          <Card size="small" style={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}` }} bodyStyle={{ padding: 0 }}>
            <PortTable
              ports={filteredPorts}
              loading={loading}
              onRefresh={loadData}
              onSelectPort={handleSelectPort}
              selectedPort={selectedPort}
              isDark={isDark}
              onViewLogs={handleViewLogs}
              highlightPort={highlightPort}
            />
          </Card>
        </Content>

        <ProcessDetail
          visible={detailVisible}
          process={processDetail}
          loading={detailLoading}
          onClose={() => { setDetailVisible(false); setSelectedPort(null); setProcessDetail(null); }}
          onKill={handleKill}
          onStartTail={(pid, filePath) => {
            handleViewLogs({ pid, local_port: '-', process_name: '-' });
            setTimeout(() => sendMessage({ type: 'tail_start', pid, file_path: filePath }), 500);
          }}
        />

        <LogModal
          visible={logModalVisible}
          port={logModalPort}
          onClose={() => { setLogModalVisible(false); setLogModalPort(null); }}
          onSendMessage={sendMessage}
        />

        <CommandExecutor
          visible={execVisible}
          onClose={() => setExecVisible(false)}
          isDark={isDark}
          onSuccess={handleExecSuccess}
        />
      </Layout>
    </ConfigProvider>
  );
}

export default App;
