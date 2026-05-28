import { useState, useMemo } from 'react';
import { Table, Tag, Space, Button, Tooltip, Badge, Input, Select } from 'antd';
import { ReloadOutlined, WarningOutlined, FolderOutlined, SearchOutlined, FileTextOutlined, FilterOutlined } from '@ant-design/icons';

const serviceColors = {
  'Nginx': '#10b981',
  'Apache': '#f59e0b',
  'Node.js': '#3b82f6',
  'Python': '#06b6d4',
  'Java': '#a855f7',
  'MySQL': '#3b82f6',
  'Redis': '#ef4444',
  'MongoDB': '#10b981',
  'HTTP': '#10b981',
  'HTTPS': '#10b981',
  'HTTP Alt': '#f59e0b',
  'HTTPS Alt': '#f59e0b',
  'Dev Server': '#3b82f6',
  'PostgreSQL': '#3b82f6',
  'MariaDB': '#3b82f6',
  'SQL Server': '#ef4444',
  'IIS': '#3b82f6',
  'Tomcat': '#f59e0b',
  'PHP': '#a855f7',
  'Docker': '#3b82f6',
  'Memcached': '#06b6d4',
  'Service': '#64748b',
};

export default function PortTable({ ports, loading, onRefresh, onSelectPort, selectedPort, isDark, onViewLogs, highlightPort }) {
  const [search, setSearch] = useState('');
  const [filterProtocol, setFilterProtocol] = useState(null);
  const [filterService, setFilterService] = useState(null);
  const [filterProcess, setFilterProcess] = useState(null);

  // 提取唯一的筛选选项
  const filterOptions = useMemo(() => {
    const protocols = [...new Set(ports.map(p => p.protocol).filter(Boolean))].sort();
    const services = [...new Set(ports.map(p => p.service_type).filter(Boolean))].sort();
    const processes = [...new Set(ports.map(p => p.process_name).filter(Boolean))].sort();
    return { protocols, services, processes };
  }, [ports]);

  const hasActiveFilter = filterProtocol || filterService || filterProcess;

  const filteredPorts = useMemo(() => {
    let result = ports;

    // 下拉筛选
    if (filterProtocol) result = result.filter(p => p.protocol === filterProtocol);
    if (filterService) result = result.filter(p => p.service_type === filterService);
    if (filterProcess) result = result.filter(p => p.process_name === filterProcess);

    // 文本搜索
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => (
        String(p.local_port).includes(q) ||
        (p.process_name || '').toLowerCase().includes(q) ||
        (p.service_type || '').toLowerCase().includes(q) ||
        (p.cmdline || '').toLowerCase().includes(q) ||
        (p.cwd || '').toLowerCase().includes(q)
      ));
    }

    return result;
  }, [ports, search, filterProtocol, filterService, filterProcess]);

  const selectStyle = {
    width: 140,
    background: isDark ? '#0f1419' : '#fff',
    borderColor: isDark ? '#1e293b' : '#d9d9d9',
  };

  const selectProps = {
    size: 'small',
    allowClear: true,
    style: selectStyle,
    popupMatchSelectWidth: false,
    dropdownStyle: {
      background: isDark ? '#1e293b' : '#fff',
      borderColor: isDark ? '#334155' : '#d9d9d9',
    },
  };

  const columns = [
    {
      title: '端口',
      dataIndex: 'local_port',
      key: 'local_port',
      width: 85,
      sorter: (a, b) => a.local_port - b.local_port,
      render: (port, record) => (
        <Space size={4}>
          {record.is_dangerous && (
            <WarningOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
          )}
          <Tooltip title={`访问 http://localhost:${port}`}>
            <Button
              type="link"
              size="small"
              style={{
                padding: 0,
                color: record.is_dangerous ? '#ff4d4f' : '#00d4ff',
                fontWeight: record.is_dangerous ? 600 : 400,
              }}
              onClick={(e) => {
                e.stopPropagation();
                window.open(`http://localhost:${port}`, '_blank');
              }}
            >
              {port}
            </Button>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 65,
      render: (protocol) => (
        <Tag
          color={protocol === 'TCP' ? 'blue' : 'orange'}
          style={{ margin: 0, fontSize: 11 }}
        >
          {protocol}
        </Tag>
      ),
    },
    {
      title: '本地地址',
      dataIndex: 'local_ip',
      key: 'local_ip',
      width: 130,
      render: (ip) => (
        <span style={{ color: isDark ? '#94a3b8' : '#666' }}>{ip}</span>
      ),
    },
    {
      title: '服务',
      dataIndex: 'service_type',
      key: 'service_type',
      width: 90,
      render: (type) => (
        <Tag
          color={serviceColors[type] || '#64748b'}
          style={{ margin: 0, fontSize: 11, border: 'none' }}
        >
          {type}
        </Tag>
      ),
    },
    {
      title: '进程',
      dataIndex: 'process_name',
      key: 'process_name',
      width: 130,
      ellipsis: true,
    },
    {
      title: '工作目录',
      dataIndex: 'cwd',
      key: 'cwd',
      width: 180,
      ellipsis: true,
      render: (cwd) => {
        if (!cwd || cwd === '-') return <span style={{ color: '#475569' }}>-</span>;
        return (
          <Tooltip title={cwd}>
            <Space size={4} style={{ color: isDark ? '#94a3b8' : '#666', fontSize: 12 }}>
              <FolderOutlined style={{ fontSize: 11 }} />
              <span style={{ fontFamily: 'monospace' }}>{cwd}</span>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'PID',
      dataIndex: 'pid',
      key: 'pid',
      width: 65,
      render: (pid) => (
        <span style={{ color: isDark ? '#94a3b8' : '#666' }}>{pid}</span>
      ),
    },
    {
      title: 'CPU',
      dataIndex: 'cpu_percent',
      key: 'cpu_percent',
      width: 60,
      render: (val) => (
        <span style={{ color: val > 50 ? '#ff4d4f' : val > 20 ? '#f59e0b' : '#10b981' }}>
          {val}%
        </span>
      ),
    },
    {
      title: '内存',
      dataIndex: 'memory_mb',
      key: 'memory_mb',
      width: 70,
      render: (val) => (
        <span style={{ color: isDark ? '#94a3b8' : '#666' }}>{val}MB</span>
      ),
    },
    {
      title: '日志',
      key: 'logs',
      width: 55,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontSize: 11 }}
          icon={<FileTextOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onViewLogs(record);
          }}
        >
        </Button>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 45,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontSize: 12 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectPort(record);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 0,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}`,
          gap: 12,
        }}
      >
        <Space size="small">
          <span style={{ color: isDark ? '#e2e8f0' : '#1a1a1a', fontWeight: 600, fontSize: 14 }}>
            端口列表
          </span>
          <Badge
            count={filteredPorts.length}
            style={{
              backgroundColor: isDark ? '#1e293b' : '#f0f0f0',
              color: isDark ? '#94a3b8' : '#666',
              boxShadow: 'none',
            }}
          />
          {search && (
            <Badge
              count={`${ports.length} 总`}
              style={{
                backgroundColor: 'transparent',
                color: isDark ? '#475569' : '#bbb',
                boxShadow: 'none',
                border: `1px solid ${isDark ? '#1e293b' : '#e8e8e8'}`,
              }}
            />
          )}
        </Space>
        <Space size="small" wrap>
          <Select
            {...selectProps}
            placeholder="协议"
            value={filterProtocol}
            onChange={setFilterProtocol}
            options={filterOptions.protocols.map(p => ({ label: p, value: p }))}
          />
          <Select
            {...selectProps}
            placeholder="服务"
            value={filterService}
            onChange={setFilterService}
            options={filterOptions.services.map(s => ({ label: s, value: s }))}
          />
          <Select
            {...selectProps}
            placeholder="进程"
            value={filterProcess}
            onChange={setFilterProcess}
            options={filterOptions.processes.map(p => ({ label: p, value: p }))}
          />
          {hasActiveFilter && (
            <Button
              size="small"
              onClick={() => { setFilterProtocol(null); setFilterService(null); setFilterProcess(null); }}
              style={{ fontSize: 11 }}
            >
              清除筛选
            </Button>
          )}
          <Input
            prefix={<SearchOutlined style={{ color: '#475569' }} />}
            placeholder="搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{
              width: 160,
              background: isDark ? '#0f1419' : '#fff',
              borderColor: isDark ? '#1e293b' : '#d9d9d9',
            }}
            size="small"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={loading}
            size="small"
          >
            刷新
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={filteredPorts.map(p => ({ ...p, key: `${p.pid}-${p.local_port}` }))}
        loading={loading}
        size="small"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          size: 'small',
        }}
        scroll={{ y: 'calc(100vh - 340px)' }}
        rowClassName={(record) => {
          const classes = [];
          if (record.is_dangerous) classes.push('dangerous-row');
          if (record.key === selectedPort?.key) classes.push('ant-table-row-selected');
          if (record.is_dangerous && record.key === selectedPort?.key) classes.push('dangerous-row-selected');
          // 高亮新启动的端口
          if (highlightPort && record.pid === highlightPort.pid && record.local_port === highlightPort.local_port) {
            classes.push('highlight-new-port');
          }
          return classes.join(' ');
        }}
        onRow={(record) => ({
          onClick: () => onSelectPort(record),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
}
