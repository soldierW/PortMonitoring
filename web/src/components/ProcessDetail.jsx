import { Drawer, Descriptions, Tag, Button, Space, Typography, Alert, List, Spin } from 'antd';
import { ExclamationCircleOutlined, FileOutlined, FolderOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export default function ProcessDetail({ visible, process, loading, onClose, onKill, onStartTail }) {
  if (!process && !loading) return null;

  const cmdline = process ? (Array.isArray(process.cmdline) ? process.cmdline.join(' ') : process.cmdline) : '';

  return (
    <Drawer
      title={
        <Space>
          <span>进程详情</span>
          {process && <Tag color="blue">PID: {process.pid}</Tag>}
        </Space>
      }
      placement="right"
      width={480}
      open={visible}
      onClose={onClose}
      extra={
        process && (
          <Button
            danger
            icon={<ExclamationCircleOutlined />}
            onClick={() => onKill(process.pid)}
          >
            终止进程
          </Button>
        )
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : process ? (
        <>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="进程名">
              <Tag>{process.name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={process.status === 'running' ? 'green' : 'orange'}>
                {process.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="启动命令">
              <Paragraph
                copyable
                ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                style={{ margin: 0, fontFamily: 'monospace', fontSize: 12 }}
              >
                {cmdline || '-'}
              </Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="工作目录">
              {process.cwd ? (
                <Space>
                  <FolderOutlined />
                  <Text copyable style={{ fontSize: 12 }}>{process.cwd}</Text>
                </Space>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="可执行文件">
              {process.exe ? (
                <Space>
                  <FileOutlined />
                  <Text copyable ellipsis style={{ maxWidth: 300, fontSize: 12 }}>{process.exe}</Text>
                </Space>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {process.username || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="CPU使用率">
              <Tag color={process.cpu_percent > 50 ? 'red' : process.cpu_percent > 20 ? 'orange' : 'green'}>
                {process.cpu_percent}%
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="内存使用">
              <Tag>{process.memory_mb}MB ({process.memory_percent}%)</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="线程数">
              {process.threads}
            </Descriptions.Item>
            <Descriptions.Item label="打开文件数">
              {process.open_files}
            </Descriptions.Item>
            <Descriptions.Item label="网络连接数">
              {process.connections}
            </Descriptions.Item>
          </Descriptions>

          {process.log_files && process.log_files.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Alert
                message="发现日志文件"
                description={
                  <List
                    size="small"
                    dataSource={process.log_files}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Button
                            type="link"
                            size="small"
                            onClick={() => onStartTail(process.pid, item)}
                          >
                            查看日志
                          </Button>
                        ]}
                      >
                        <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{item}</Text>
                      </List.Item>
                    )}
                  />
                }
                type="info"
                showIcon
              />
            </div>
          )}
        </>
      ) : null}
    </Drawer>
  );
}
