import { Switch } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <Switch
      checked={isDark}
      onChange={onToggle}
      checkedChildren={<MoonOutlined />}
      unCheckedChildren={<SunOutlined />}
    />
  );
}
