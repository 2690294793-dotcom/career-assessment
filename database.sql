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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
