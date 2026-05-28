import { Alert, Collapse, Tag, Typography, Space, List, Badge } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export default function ConflictAlert({ conflicts }) {
  if (!conflicts || conflicts.length === 0) {
    return null;
  }

  return (
    <Alert
      message={
        <Space>
          <WarningOutlined style={{ color: '#f59e0b' }} />
          <span style={{ fontWeight: 600 }}>端口冲突</span>
          <Badge count={conflicts.length} style={{ backgroundColor: '#ff4d4f' }} />
        </Space>
      }
      description={
        <Collapse
          size="small"
          items={conflicts.map((conflict, index) => ({
            key: index,
            label: (
              <Space>
                <Tag color="red">端口 {conflict.port}</Tag>
                <Text style={{ color: '#94a3b8' }}>{conflict.count} 个进程监听</Text>
              </Space>
            ),
            children: (
              <List
                size="small"
                dataSource={conflict.processes}
                renderItem={(proc) => (
                  <List.Item>
                    <Space>
                      <Tag>{proc.name}</Tag>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>PID: {proc.pid}</Text>
                    </Space>
                    {proc.cmdline && proc.cmdline !== '-' && (
                      <Paragraph
                        ellipsis={{ rows: 1 }}
                        style={{ margin: 0, fontSize: 11, color: '#475569', fontFamily: 'monospace' }}
                      >
                        {proc.cmdline}
                      </Paragraph>
                    )}
                  </List.Item>
                )}
              />
            ),
          }))}
          style={{ marginTop: 8 }}
        />
      }
      type="warning"
      showIcon={false}
      style={{
        marginBottom: 16,
        background: 'rgba(245, 158, 11, 0.06)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
      }}
    />
  );
}
