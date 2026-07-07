-- ============================================
-- 自在生涯工作室 - 完整数据库建表脚本
-- ============================================
-- 在 Supabase 的 SQL Editor 中执行此脚本
-- ============================================

-- 1. 测评提交表（已有，保持不变）
CREATE TABLE IF NOT EXISTS submissions (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  school TEXT DEFAULT '',
  student_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'holland',
  test_name TEXT,
  answers JSONB NOT NULL DEFAULT '{}',
  scores JSONB NOT NULL DEFAULT '{}',
  result_code TEXT NOT NULL DEFAULT '',
  result_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 预约咨询表
CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  appointment_no TEXT NOT NULL UNIQUE,
  student_name TEXT NOT NULL,
  student_phone TEXT DEFAULT '',
  student_email TEXT DEFAULT '',
  student_school TEXT DEFAULT '',
  mentor_id TEXT NOT NULL,
  mentor_name TEXT NOT NULL,
  consult_type TEXT NOT NULL,
  consult_type_name TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  problem_desc TEXT DEFAULT '',
  direction TEXT DEFAULT '',
  direction_label TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  -- status: pending(待处理), accepted(已同意), rejected(已拒绝), completed(已完成), cancelled(已取消)
  teacher_response TEXT DEFAULT '',
  consultation_notes TEXT DEFAULT '',
  student_rating INTEGER DEFAULT 0,
  feedback_tags JSONB DEFAULT '[]',
  feedback_text TEXT DEFAULT '',
  feedback_at TIMESTAMPTZ,
  has_feedback BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 预约表反馈字段扩展（兼容已创建的旧表）
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS feedback_tags JSONB DEFAULT '[]';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS feedback_text TEXT DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS has_feedback BOOLEAN DEFAULT FALSE;

-- 3. 测评报告导出记录
CREATE TABLE IF NOT EXISTS report_exports (
  id BIGSERIAL PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_school TEXT NOT NULL,
  student_id TEXT DEFAULT '',
  class_name TEXT DEFAULT '',
  test_type TEXT NOT NULL,
  test_name TEXT,
  result_code TEXT DEFAULT '',
  result_summary TEXT,
  scores JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS 策略
-- ============================================
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;

-- submissions
CREATE POLICY "允许学生提交" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "允许教师查看" ON submissions FOR SELECT USING (true);
CREATE POLICY "允许教师删除" ON submissions FOR DELETE USING (true);

-- appointments
CREATE POLICY "允许任何人提交预约" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "允许任何人查看预约" ON appointments FOR SELECT USING (true);
CREATE POLICY "允许教师更新预约状态" ON appointments FOR UPDATE USING (true);
CREATE POLICY "允许教师删除预约" ON appointments FOR DELETE USING (true);

-- report_exports
CREATE POLICY "允许任何人提交报告" ON report_exports FOR INSERT WITH CHECK (true);
CREATE POLICY "允许教师查看报告" ON report_exports FOR SELECT USING (true);
CREATE POLICY "允许教师删除报告" ON report_exports FOR DELETE USING (true);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_class ON submissions(class_name);
CREATE INDEX IF NOT EXISTS idx_submissions_test_type ON submissions(test_type);
CREATE INDEX IF NOT EXISTS idx_submissions_school ON submissions(school);

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_mentor ON appointments(mentor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_created ON appointments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_no ON appointments(appointment_no);

-- ============================================
-- 实时订阅（Realtime）
-- ============================================
-- Supabase 默认开启 Realtime，无需额外配置
-- 如需手动开启：
-- ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

-- ============================================
-- 自动更新 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 公众号文章表（自动同步）
-- ============================================
CREATE TABLE IF NOT EXISTS articles (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  content TEXT DEFAULT '',
  category TEXT DEFAULT 'insight',
  category_name TEXT DEFAULT '职场洞察',
  date TEXT DEFAULT '',
  views TEXT DEFAULT '阅读 0',
  likes INTEGER DEFAULT 0,
  cover TEXT DEFAULT '',
  author TEXT DEFAULT '自在生涯工作室',
  search_text TEXT DEFAULT '',
  wx_url TEXT DEFAULT '',
  wx_media_id TEXT DEFAULT '',
  source TEXT DEFAULT 'preset',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wx_media_id)
);

-- articles RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许任何人查看文章" ON articles FOR SELECT USING (true);
CREATE POLICY "允许服务端同步写入" ON articles FOR INSERT WITH CHECK (true);
CREATE POLICY "允许服务端同步更新" ON articles FOR UPDATE USING (true);

-- articles 索引
CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);

-- 5. 导师时间表（教师端设定可预约时段，按具体日期）
CREATE TABLE IF NOT EXISTS mentor_schedule (
  id BIGSERIAL PRIMARY KEY,
  mentor_id TEXT NOT NULL,
  specific_date DATE NOT NULL,   -- 具体日期，如 '2026-07-08'
  start_time TEXT NOT NULL,      -- HH:MM 格式，如 '09:00'
  end_time TEXT NOT NULL,        -- HH:MM 格式，如 '12:00'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 导师预约开关设置
CREATE TABLE IF NOT EXISTS mentor_settings (
  id BIGSERIAL PRIMARY KEY,
  mentor_id TEXT NOT NULL UNIQUE,
  booking_open BOOLEAN DEFAULT true,  -- 是否接受预约（全局开关）
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- mentor_schedule RLS
ALTER TABLE mentor_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许任何人查看导师时间表" ON mentor_schedule FOR SELECT USING (true);
CREATE POLICY "允许教师管理时间表" ON mentor_schedule FOR INSERT WITH CHECK (true);
CREATE POLICY "允许教师更新时间表" ON mentor_schedule FOR UPDATE USING (true);
CREATE POLICY "允许教师删除时间表" ON mentor_schedule FOR DELETE USING (true);

-- mentor_settings RLS
ALTER TABLE mentor_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "允许任何人查看导师设置" ON mentor_settings FOR SELECT USING (true);
CREATE POLICY "允许教师更新设置" ON mentor_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "允许教师修改设置" ON mentor_settings FOR UPDATE USING (true);
CREATE POLICY "允许教师删除设置" ON mentor_settings FOR DELETE USING (true);

-- articles updated_at 触发器
DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- mentor_schedule 索引
CREATE INDEX IF NOT EXISTS idx_mentor_schedule_mentor ON mentor_schedule(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_schedule_date ON mentor_schedule(specific_date);

-- 为每个导师初始化默认设置
INSERT INTO mentor_settings (mentor_id, booking_open) VALUES
  ('hexia', true),
  ('wanglina', true),
  ('gongjingxian', true),
  ('huangjieqi', true),
  ('panwenhao', true)
ON CONFLICT (mentor_id) DO NOTHING;
