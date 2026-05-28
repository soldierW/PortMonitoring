import { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, Space, Tag, Typography, Divider, Tooltip, message } from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ClearOutlined,
  FolderOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  PlusOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const DEFAULT_PRESETS = [
  { label: 'npx http-server', value: 'npx http-server', group: 'HTTP' },
  { label: 'npx serve', value: 'npx serve', group: 'HTTP' },
  { label: 'python -m http.server', value: 'python -m http.server', group: 'HTTP' },
  { label: 'npm run dev', value: 'npm run dev', group: 'Node.js' },
  { label: 'npm start', value: 'npm start', group: 'Node.js' },
  { label: 'yarn dev', value: 'yarn dev', group: 'Node.js' },
  { label: 'pnpm dev', value: 'pnpm dev', group: 'Node.js' },
  { label: 'npm run build', value: 'npm run build', group: 'Node.js' },
  { label: 'pip install -r requirements.txt', value: 'pip install -r requirements.txt', group: 'Python' },
  { label: 'python app.py', value: 'python app.py', group: 'Python' },
  { label: 'uvicorn main:app --reload', value: 'uvicorn main:app --reload', group: 'Python' },
  { label: 'java -jar app.jar', value: 'java -jar app.jar', group: 'Java' },
  { label: 'mvn spring-boot:run', value: 'mvn spring-boot:run', group: 'Java' },
  { label: 'go run .', value: 'go run .', group: 'Go' },
  { label: 'docker compose up', value: 'docker compose up', group: 'Docker' },
  { label: 'git status', value: 'git status', group: 'Git' },
];

function loadCustomPresets() {
  try {
    return JSON.parse(localStorage.getItem('pm_custom_presets') || '[]');
  } catch { return []; }
}

function saveCustomPresets(presets) {
  localStorage.setItem('pm_custom_presets', JSON.stringify(presets));
}

export default function CommandExecutor({ visible, onClose, isDark, onSuccess }) {
  const [selectedDir, setSelectedDir] = useState('');
  const [command, setCommand] = useState('');
  const [execId, setExecId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState([]);
  const [loading, setLoading] = useState(false);

  // 目录浏览器状态
  const [browseVisible, setBrowseVisible] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [browseDirs, setBrowseDirs] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // 自定义预设
  const [customPresets, setCustomPresets] = useState(loadCustomPresets);
  const [addingPreset, setAddingPreset] = useState(false);
  const [newPresetCmd, setNewPresetCmd] = useState('');
  const [newPresetLabel, setNewPresetLabel] = useState('');

  const outputRef = useRef(null);
  const pollRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const onSuccessRef = useRef(onSuccess);
  onCloseRef.current = onClose;
  onSuccessRef.current = onSuccess;

  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

  useEffect(() => {
    if (visible) {
      setOutput([]);
      setExecId(null);
      setIsRunning(false);
    }
  }, [visible]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // 目录浏览
  const browseDir = async (path) => {
    setBrowseLoading(true);
    try {
      const resp = await fetch(`/api/browse?path=${encodeURIComponent(path || '')}`);
      const data = await resp.json();
      setBrowsePath(data.current || '');
      setBrowseDirs(data.directories || []);
    } catch (e) {
      console.error('Browse failed:', e);
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleBrowseOpen = () => {
    setBrowseVisible(true);
    browseDir(selectedDir || '');
  };

  const handleSelectDir = (path) => {
    setSelectedDir(path);
    setBrowseVisible(false);
  };

  // 自定义预设管理
  const handleAddPreset = () => {
    if (!newPresetCmd.trim()) return;
    const newPreset = {
      label: newPresetLabel.trim() || newPresetCmd.trim(),
      value: newPresetCmd.trim(),
      group: '自定义',
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setNewPresetCmd('');
    setNewPresetLabel('');
    setAddingPreset(false);
  };

  const handleDeletePreset = (value) => {
    const updated = customPresets.filter(p => p.value !== value);
    setCustomPresets(updated);
    saveCustomPresets(updated);
  };

  // 执行命令
  const handleStart = async () => {
    if (!command.trim()) return;
    setLoading(true);
    setOutput([{ text: `> ${command}`, type: 'cmd' }]);

    // 记录执行前的端口列表
    let portsBefore = [];
    try {
      const resp = await fetch('/api/ports');
      const data = await resp.json();
      portsBefore = (data.ports || []).map(p => `${p.local_ip}:${p.local_port}`);
    } catch {}

    try {
      const resp = await fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim(), cwd: selectedDir }),
      });
      const data = await resp.json();
      if (data.error) {
        setOutput(prev => [...prev, { text: data.error, type: 'error' }]);
        return;
      }
      setExecId(data.exec_id);
      setIsRunning(true);
      setOutput(prev => [...prev, { text: `工作目录: ${data.cwd}`, type: 'info' }]);
      startPolling(data.exec_id, portsBefore);
    } catch (e) {
      setOutput(prev => [...prev, { text: `执行失败: ${e.message}`, type: 'error' }]);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id, portsBefore = []) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let pollCount = 0;
    let processExited = false;
    let exitCode = null;
    pollRef.current = setInterval(async () => {
      pollCount++;
      try {
        // 每次轮询都检查是否有新端口
        const portResp = await fetch('/api/ports');
        const portData = await portResp.json();
        const portsAfter = portData.ports || [];
        const newPort = portsAfter.find(p => !portsBefore.includes(`${p.local_ip}:${p.local_port}`));

        if (newPort) {
          // 检测到新端口，立即关闭
          clearInterval(pollRef.current);
          setIsRunning(false);
          message.success({ content: `服务已启动 - 端口 ${newPort.local_port}`, duration: 3 });
          onCloseRef.current();
          if (onSuccessRef.current) {
            setTimeout(() => onSuccessRef.current(newPort), 300);
          }
          return;
        }

        // 同时获取命令输出
        const resp = await fetch(`/api/exec/${id}/logs`);
        const data = await resp.json();
        if (data.lines && data.lines.length > 0) {
          setOutput(prev => {
            // 保留前两行（命令+工作目录），后面用后端日志替换
            const header = prev.slice(0, 2);
            const logLines = data.lines.map(l => ({ text: l, type: 'output' }));
            return [...header, ...logLines];
          });
        }

        // 如果命令已退出
        if (!data.is_running && !processExited) {
          processExited = true;
          exitCode = data.return_code;
          if (exitCode !== 0) {
            setOutput(prev => [...prev, { text: `退出码: ${exitCode}`, type: 'error' }]);
          }
          // 不立即停止，继续等待新端口出现（start /b 后包装进程先退出，实际服务还在启动）
        }

        // 命令退出后继续轮询10秒等待新端口，或总超时30秒
        if (processExited && pollCount > 10) {
          clearInterval(pollRef.current);
          setIsRunning(false);
          if (exitCode === 0) {
            setOutput(prev => [...prev, { text: '命令已在后台运行', type: 'info' }]);
          }
          onCloseRef.current();
          return;
        }

        if (pollCount > 30) {
          clearInterval(pollRef.current);
          setIsRunning(false);
          message.info({ content: '超时，命令可能仍在后台运行', duration: 2 });
          onCloseRef.current();
        }
      } catch {}
    }, 1000);
  };

  const handleStop = async () => {
    if (execId) {
      try { await fetch(`/api/exec/${execId}/stop`, { method: 'POST' }); } catch {}
    }
    if (pollRef.current) clearInterval(pollRef.current);
    setIsRunning(false);
    setOutput(prev => [...prev, { text: '--- 已终止 ---', type: 'info' }]);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <>
      <Modal
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#00d4ff' }} />
            <span>执行命令</span>
            {isRunning && <Tag color="green" style={{ animation: 'blink 1.5s infinite' }}>RUNNING</Tag>}
          </Space>
        }
        open={visible}
        onCancel={onClose}
        width={780}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStart}
              loading={loading}
              disabled={isRunning || !command.trim()}
              size="large"
              style={{
                height: 40,
                fontSize: 15,
                fontWeight: 600,
                boxShadow: isRunning ? 'none' : '0 0 16px #00d4ff44',
                minWidth: 140,
              }}
            >
              {isRunning ? '运行中...' : '执行'}
            </Button>
            <Space>
              <Button
                icon={<StopOutlined />}
                onClick={handleStop}
                disabled={!isRunning}
                danger
              >
                终止
              </Button>
              <Button icon={<ClearOutlined />} onClick={() => setOutput([])}>
                清空
              </Button>
            </Space>
          </div>
        }
      >
        {/* 工作目录 */}
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: isDark ? '#94a3b8' : '#666', fontSize: 12, display: 'block', marginBottom: 4 }}>
            <FolderOutlined /> 工作目录
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={selectedDir}
              onChange={(e) => setSelectedDir(e.target.value)}
              placeholder="输入路径或点击浏览选择"
              style={{
                flex: 1,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                background: isDark ? '#0f1419' : '#fff',
                borderColor: isDark ? '#1e293b' : '#d9d9d9',
              }}
              allowClear
              prefix={<FolderOutlined style={{ color: '#475569' }} />}
            />
            <Button
              icon={<FolderOpenOutlined />}
              onClick={handleBrowseOpen}
              style={{
                borderColor: isDark ? '#334155' : '#d9d9d9',
                color: isDark ? '#94a3b8' : '#333',
              }}
            >
              浏览
            </Button>
          </div>
        </div>

        {/* 常用命令 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ color: isDark ? '#94a3b8' : '#666', fontSize: 12 }}>
              <CodeOutlined /> 常用命令
            </Text>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setAddingPreset(!addingPreset)}
              style={{ fontSize: 12, padding: 0 }}
            >
              新增
            </Button>
          </div>

          {/* 新增预设表单 */}
          {addingPreset && (
            <div style={{
              marginBottom: 8,
              padding: 8,
              background: isDark ? '#1e293b' : '#f5f5f5',
              borderRadius: 6,
              border: `1px solid ${isDark ? '#334155' : '#d9d9d9'}`,
            }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Input
                  size="small"
                  placeholder="命令标签，如: 启动前端"
                  value={newPresetLabel}
                  onChange={(e) => setNewPresetLabel(e.target.value)}
                  style={{ fontSize: 12 }}
                />
                <Input
                  size="small"
                  placeholder="命令内容，如: npm run dev"
                  value={newPresetCmd}
                  onChange={(e) => setNewPresetCmd(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                  onPressEnter={handleAddPreset}
                />
                <Space>
                  <Button size="small" type="primary" onClick={handleAddPreset}>
                    添加
                  </Button>
                  <Button size="small" onClick={() => setAddingPreset(false)}>
                    取消
                  </Button>
                </Space>
              </Space>
            </div>
          )}

          {/* 预设命令标签 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allPresets.map((preset) => (
              <Tag
                key={preset.value}
                style={{
                  cursor: 'pointer',
                  background: command === preset.value ? '#00d4ff22' : isDark ? '#1e293b' : '#f0f0f0',
                  borderColor: command === preset.value ? '#00d4ff' : isDark ? '#334155' : '#d9d9d9',
                  color: command === preset.value ? '#00d4ff' : isDark ? '#94a3b8' : '#333',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => setCommand(preset.value)}
              >
                <span>{preset.label}</span>
                {preset.group === '自定义' && (
                  <DeleteOutlined
                    onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.value); }}
                    style={{ fontSize: 10, color: '#ff4d4f', cursor: 'pointer' }}
                  />
                )}
              </Tag>
            ))}
          </div>
        </div>

        {/* 命令输入 */}
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: isDark ? '#94a3b8' : '#666', fontSize: 12, display: 'block', marginBottom: 4 }}>
            <PlayCircleOutlined /> 命令
          </Text>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="输入命令，如: npm run dev"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              background: isDark ? '#0f1419' : '#fff',
              borderColor: isDark ? '#1e293b' : '#d9d9d9',
            }}
            onPressEnter={handleStart}
          />
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* 输出控制台 */}
        <div
          ref={outputRef}
          style={{
            height: 320,
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
          {output.length === 0 ? (
            <div style={{ color: '#475569', textAlign: 'center', marginTop: 80 }}>
              <ThunderboltOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
              选择目录和命令，点击「执行」
            </div>
          ) : (
            output.map((line, i) => (
              <div
                key={i}
                style={{
                  color:
                    line.type === 'error' ? '#ff4d4f' :
                    line.type === 'cmd' ? '#00d4ff' :
                    line.type === 'info' ? '#f59e0b' : '#94a3b8',
                  fontWeight: line.type === 'cmd' ? 600 : 400,
                  borderBottom: line.type === 'cmd' ? '1px solid #1e293b' : undefined,
                  padding: line.type === 'cmd' ? '4px 0' : undefined,
                }}
              >
                {line.text}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* 目录浏览器 Modal */}
      <Modal
        title={
          <Space>
            <FolderOpenOutlined style={{ color: '#00d4ff' }} />
            <span>选择目录</span>
          </Space>
        }
        open={browseVisible}
        onCancel={() => setBrowseVisible(false)}
        footer={null}
        width={550}
      >
        {/* 当前路径 + 返回上级 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <Tooltip title="返回上级">
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              onClick={() => {
                const parent = browseDirs.find(d => d.type === 'parent');
                if (parent) browseDir(parent.path);
              }}
              disabled={!browsePath || !browseDirs.find(d => d.type === 'parent')}
            />
          </Tooltip>
          <Tooltip title="返回根目录">
            <Button
              size="small"
              icon={<HomeOutlined />}
              onClick={() => browseDir('')}
            />
          </Tooltip>
          <Input
            value={browsePath}
            onChange={(e) => setBrowsePath(e.target.value)}
            onPressEnter={(e) => browseDir(e.target.value)}
            style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: 12,
              background: isDark ? '#0f1419' : '#fff',
            }}
            size="small"
          />
          <Button size="small" onClick={() => browseDir(browsePath)}>跳转</Button>
        </div>

        {/* 目录列表 */}
        <div style={{
          height: 350,
          overflow: 'auto',
          background: '#0a0e14',
          borderRadius: 6,
          border: '1px solid #1e293b',
          padding: 4,
        }}>
          {browseLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>加载中...</div>
          ) : browseDirs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>无子目录</div>
          ) : (
            browseDirs.map((dir) => (
              <div
                key={dir.path}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 4,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1e293b'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={() => {
                  if (dir.type === 'parent') {
                    browseDir(dir.path);
                  } else if (dir.type === 'drive') {
                    browseDir(dir.path);
                  } else {
                    browseDir(dir.path);
                  }
                }}
                onDoubleClick={() => handleSelectDir(dir.path)}
              >
                <FolderOutlined style={{ color: dir.type === 'drive' ? '#f59e0b' : '#00d4ff', fontSize: 14 }} />
                <span>{dir.name}</span>
                {dir.type === 'drive' && (
                  <Tag style={{ marginLeft: 'auto', fontSize: 10 }}>磁盘</Tag>
                )}
              </div>
            ))
          )}
        </div>

        {/* 选中按钮 */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setBrowseVisible(false)}>取消</Button>
          <Button
            type="primary"
            disabled={!browsePath}
            onClick={() => handleSelectDir(browsePath)}
          >
            选择当前目录
          </Button>
        </div>
      </Modal>
    </>
  );
}
