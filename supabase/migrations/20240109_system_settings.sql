-- 系统配置表
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(100),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_category ON system_settings(category);

-- RLS策略
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 管理员可以读写
CREATE POLICY "Admins can manage settings"
  ON system_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

-- 所有用户可以读取（用于前端显示）
CREATE POLICY "All users can read settings"
  ON system_settings
  FOR SELECT
  USING (true);

-- 插入默认配置
INSERT INTO system_settings (key, value, description, category) VALUES
  ('pricing', '{"basic":{"monthly":30,"yearly":288},"pro":{"monthly":99,"yearly":950},"enterprise":{"monthly":199,"yearly":1910}}', '会员价格配置', 'pricing'),
  ('quotas', '{"free":50,"basic":150,"pro":500,"enterprise":-1}', '功能额度配置', 'features'),
  ('features', '{"registration":true,"payment":true,"scriptGeneration":true,"topicPlanning":true}', '功能开关', 'features'),
  ('site', '{"name":"小宋编导工作台","description":"AI驱动的编导创作平台","supportEmail":"support@example.com"}', '站点配置', 'general')
ON CONFLICT (key) DO NOTHING;

-- 注释
COMMENT ON TABLE system_settings IS '系统配置表';
COMMENT ON COLUMN system_settings.key IS '配置键（唯一）';
COMMENT ON COLUMN system_settings.value IS '配置值（JSON格式）';
COMMENT ON COLUMN system_settings.category IS '配置分类';