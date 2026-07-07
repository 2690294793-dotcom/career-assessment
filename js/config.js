// ============================================
// Supabase 配置文件
// ============================================
// 使用前请替换下面的 URL 和 KEY 为你自己的 Supabase 项目信息
//
// 获取步骤：
// 1. 打开 https://supabase.com 注册并登录（免费）
// 2. 点击 "New Project" 创建新项目
// 3. 创建完成后，进入项目设置 → API
// 4. 复制 "Project URL" 填到下面的 SUPABASE_URL
// 5. 复制 "anon public" key 填到下面的 SUPABASE_KEY
// 6. 在 Supabase 的 SQL Editor 中执行 database.sql 建表
//
// 详细图文教程见 setup-guide.html
// ============================================

// ============================================
// 学校身份验证配置
// ============================================
const SCHOOL_NAMES = "广州职业技术大学";

function verifySchool(input) {
  if (!input) return false;
  var normalized = input.trim().toLowerCase().replace(/\s+/g, "");
  var names = SCHOOL_NAMES.split(",").map(function (s) {
    return s.trim().toLowerCase().replace(/\s+/g, "");
  });
  return names.some(function (n) {
    return normalized === n || normalized.indexOf(n) !== -1 || n.indexOf(normalized) !== -1;
  });
}

const SUPABASE_URL = "https://nipkszvyehgjnufvqjnf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pcGtzenZ5ZWhnam51ZnZxam5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTU5NjQsImV4cCI6MjA5ODczMTk2NH0.qvRsX3gaxxznF8dXOgfJyKYSCEsdyb12WQXpGWjR8Vc";

// 创建 Supabase 客户端实例
let db = null;
let realtimeChannel = null;

function initSupabase() {
  if (typeof window !== "undefined" && window.supabase && SUPABASE_URL && SUPABASE_KEY &&
      SUPABASE_URL !== "https://YOUR_PROJECT.supabase.co" &&
      SUPABASE_URL.indexOf("YOUR") === -1) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("[Supabase] 已连接");
    return true;
  }
  console.warn("[Supabase] 未配置，数据将仅保存在本地浏览器中（不会同步）");
  return false;
}

function isDbReady() { return db !== null; }

// ============================================
// 1. 测评提交 (submissions)
// ============================================

async function saveSubmission(data) {
  // 如果 db 为 null，尝试重新初始化（可能 CDN 延迟导致首次 init 失败）
  if (!db && typeof initSupabase === "function") {
    initSupabase();
  }
  if (db) {
    const { data: result, error } = await db
      .from("submissions")
      .insert(data)
      .select();
    if (error) throw error;
    return { record: result[0], savedToCloud: true };
  }
  // 本地降级
  const local = JSON.parse(localStorage.getItem("local_submissions") || "[]");
  const record = { ...data, id: Date.now(), created_at: new Date().toISOString() };
  local.push(record);
  localStorage.setItem("local_submissions", JSON.stringify(local));
  return { record: record, savedToCloud: false };
}

async function getAllSubmissions() {
  if (db) {
    const { data, error } = await db
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
  return JSON.parse(localStorage.getItem("local_submissions") || "[]");
}

async function deleteSubmission(id) {
  if (db) {
    const { error } = await db.from("submissions").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
  const local = JSON.parse(localStorage.getItem("local_submissions") || "[]");
  const filtered = local.filter((r) => r.id !== id);
  localStorage.setItem("local_submissions", JSON.stringify(filtered));
  return true;
}

// ============================================
// 2. 测评报告导出 (report_exports)
// ============================================

async function saveReportExport(data) {
  if (db) {
    const { data: result, error } = await db
      .from("report_exports")
      .insert(data)
      .select();
    if (error) throw error;
    return result[0];
  }
  // 本地降级
  console.log("[本地] 报告数据已保存到本地");
  return { id: Date.now(), ...data };
}

async function getReportExports() {
  if (db) {
    const { data, error } = await db
      .from("report_exports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
  return [];
}

// ============================================
// 3. 预约咨询 (appointments)
// ============================================

// 生成预约编号
function genAppointmentNo() {
  return "APT" + Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substring(2, 5).toUpperCase();
}

// 提交预约
async function createAppointment(data) {
  // 如果 db 为 null，尝试重新初始化（可能 CDN 延迟导致首次 init 失败）
  if (!db && typeof initSupabase === "function") {
    initSupabase();
  }

  const apt = {
    appointment_no: genAppointmentNo(),
    student_name: data.student_name || "",
    student_phone: data.student_phone || "",
    student_email: data.student_email || "",
    student_school: data.student_school || "",
    mentor_id: data.mentor_id || "",
    mentor_name: data.mentor_name || "",
    consult_type: data.consult_type || "",
    consult_type_name: data.consult_type_name || "",
    appointment_date: data.appointment_date || "",
    appointment_time: data.appointment_time || "",
    problem_desc: data.problem_desc || "",
    direction: data.direction || "",
    direction_label: data.direction_label || "",
    status: "pending"
  };

  if (db) {
    try {
      const { data: result, error } = await db
        .from("appointments")
        .insert(apt)
        .select();
      if (error) throw error;
      console.log("[Supabase] 预约已提交:", apt.appointment_no);
      return result[0];
    } catch(e) {
      console.error("[Supabase] 预约提交失败，降级到本地:", e.message);
      // Supabase 失败时降级到本地存储，不让用户看到失败
    }
  }

  // 本地降级
  const local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  const record = { ...apt, id: Date.now(), created_at: new Date().toISOString() };
  local.push(record);
  localStorage.setItem("zt_appointments", JSON.stringify(local));
  console.log("[本地] 预约已保存:", apt.appointment_no);
  return record;
}

// 获取所有预约
async function getAppointments(filter) {
  filter = filter || {};
  if (db) {
    let query = db.from("appointments").select("*").order("created_at", { ascending: false });
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.mentor_id) query = query.eq("mentor_id", filter.mentor_id);
    if (filter.student_name) query = query.ilike("student_name", "%" + filter.student_name + "%");
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  var local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  if (filter.status) local = local.filter(function(a) { return a.status === filter.status; });
  if (filter.mentor_id) local = local.filter(function(a) { return a.mentor_id === filter.mentor_id; });
  return local.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
}

// 更新预约状态（教师同意/拒绝/完成）
async function updateAppointmentStatus(id, status, response) {
  if (db) {
    const update = { status: status, updated_at: new Date().toISOString() };
    if (response) update.teacher_response = response;
    const { data, error } = await db
      .from("appointments")
      .update(update)
      .eq("id", id)
      .select();
    if (error) throw error;
    console.log("[Supabase] 预约状态已更新:", id, "→", status);
    return data[0];
  }
  var local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  var idx = local.findIndex(function(a) { return a.id === id || String(a.id) === String(id); });
  if (idx >= 0) {
    local[idx].status = status;
    if (response) local[idx].teacher_response = response;
    local[idx].updated_at = new Date().toISOString();
    localStorage.setItem("zt_appointments", JSON.stringify(local));
  }
  return local[idx];
}

// 教师填写咨询记录
async function saveConsultationNotes(id, notes) {
  if (db) {
    const { data, error } = await db
      .from("appointments")
      .update({
        consultation_notes: notes,
        status: "completed",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select();
    if (error) throw error;
    console.log("[Supabase] 咨询记录已保存:", id);
    return data[0];
  }
  var local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  var idx = local.findIndex(function(a) { return a.id === id || String(a.id) === String(id); });
  if (idx >= 0) {
    local[idx].consultation_notes = notes;
    local[idx].status = "completed";
    local[idx].updated_at = new Date().toISOString();
    localStorage.setItem("zt_appointments", JSON.stringify(local));
  }
  return local[idx];
}

// 按预约编号查询
async function getAppointmentByNo(appointmentNo) {
  if (db) {
    const { data, error } = await db
      .from("appointments")
      .select("*")
      .eq("appointment_no", appointmentNo)
      .single();
    if (error) return null;
    return data;
  }
  var local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  return local.find(function(a) { return a.appointment_no === appointmentNo; }) || null;
}

// 保存学生反馈（在 consult-flow.html 或我的预约中调用）
async function saveFeedback(appointmentNo, feedback) {
  feedback = feedback || {};
  if (!appointmentNo) {
    throw new Error('缺少预约编号');
  }
  const payload = {
    student_rating: feedback.rating || 0,
    feedback_tags: Array.isArray(feedback.tags) ? feedback.tags : [],
    feedback_text: feedback.text || '',
    feedback_at: new Date().toISOString(),
    has_feedback: true,
    updated_at: new Date().toISOString()
  };

  if (db) {
    try {
      const { data, error } = await db
        .from("appointments")
        .update(payload)
        .eq("appointment_no", appointmentNo)
        .select();
      if (error) throw error;
      console.log("[Supabase] 反馈已保存:", appointmentNo);
      return data[0];
    } catch(e) {
      console.error("[Supabase] 反馈保存失败，降级到本地:", e.message);
    }
  }

  // 本地降级
  var local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  var idx = local.findIndex(function(a) { return a.appointment_no === appointmentNo; });
  if (idx < 0) {
    throw new Error('未找到本地预约记录：' + appointmentNo);
  }
  local[idx] = { ...local[idx], ...payload };
  localStorage.setItem("zt_appointments", JSON.stringify(local));
  console.log("[本地] 反馈已保存:", appointmentNo);
  return local[idx];
}

// 删除预约
async function deleteAppointment(id) {
  if (db) {
    const { error } = await db.from("appointments").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
  var local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  local = local.filter(function(a) { return a.id !== id && String(a.id) !== String(id); });
  localStorage.setItem("zt_appointments", JSON.stringify(local));
  return true;
}

// 按预约编号列表批量查询（学生端查询自己的预约历史）
async function getMyAppointments(appointmentNos) {
  if (!appointmentNos || appointmentNos.length === 0) return [];
  if (db) {
    const { data, error } = await db
      .from("appointments")
      .select("*")
      .in("appointment_no", appointmentNos)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }
  var local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  return local
    .filter(function(a) { return appointmentNos.indexOf(a.appointment_no) >= 0; })
    .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
}

// 统计
async function getAppointmentStats() {
  if (db) {
    const { data, error } = await db
      .from("appointments")
      .select("status");
    if (error) throw error;
    var stats = { total: data.length, pending: 0, accepted: 0, rejected: 0, completed: 0 };
    data.forEach(function(a) {
      if (stats[a.status] !== undefined) stats[a.status]++;
    });
    return stats;
  }
  var local = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
  var stats = { total: local.length, pending: 0, accepted: 0, rejected: 0, completed: 0 };
  local.forEach(function(a) {
    if (stats[a.status] !== undefined) stats[a.status]++;
  });
  return stats;
}

// ============================================
// 5. 导师时间表 (mentor_schedule)
// ============================================

// 获取某个导师的时间表
async function getMentorSchedule(mentorId) {
  if (db) {
    const { data, error } = await db
      .from("mentor_schedule")
      .select("*")
      .eq("mentor_id", mentorId)
      .order("specific_date", { ascending: true });
    if (error) throw error;
    return data;
  }
  var local = JSON.parse(localStorage.getItem("zt_mentor_schedule") || "[]");
  return local.filter(function(s) { return s.mentor_id === mentorId; });
}

// 获取所有导师的时间表
async function getAllMentorSchedules() {
  if (db) {
    const { data, error } = await db
      .from("mentor_schedule")
      .select("*")
      .order("mentor_id", { ascending: true });
    if (error) throw error;
    return data;
  }
  return JSON.parse(localStorage.getItem("zt_mentor_schedule") || "[]");
}

// 添加时间段
async function addScheduleSlot(slot) {
  if (db) {
    const { data, error } = await db
      .from("mentor_schedule")
      .insert(slot)
      .select();
    if (error) throw error;
    return data[0];
  }
  var local = JSON.parse(localStorage.getItem("zt_mentor_schedule") || "[]");
  var record = { ...slot, id: Date.now(), created_at: new Date().toISOString() };
  local.push(record);
  localStorage.setItem("zt_mentor_schedule", JSON.stringify(local));
  return record;
}

// 删除时间段
async function deleteScheduleSlot(id) {
  if (db) {
    const { error } = await db.from("mentor_schedule").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
  var local = JSON.parse(localStorage.getItem("zt_mentor_schedule") || "[]");
  local = local.filter(function(s) { return s.id !== id && String(s.id) !== String(id); });
  localStorage.setItem("zt_mentor_schedule", JSON.stringify(local));
  return true;
}

// ============================================
// 6. 导师预约开关 (mentor_settings)
// ============================================

// 获取某个导师的预约开关设置
async function getMentorSettings(mentorId) {
  if (db) {
    const { data, error } = await db
      .from("mentor_settings")
      .select("*")
      .eq("mentor_id", mentorId)
      .single();
    if (error) {
      // 如果不存在，创建默认设置
      if (error.code === 'PGRST116') {
        return await createMentorSettings(mentorId);
      }
      throw error;
    }
    return data;
  }
  var local = JSON.parse(localStorage.getItem("zt_mentor_settings") || "[]");
  var found = local.find(function(s) { return s.mentor_id === mentorId; });
  if (!found) {
    found = { mentor_id: mentorId, booking_open: true };
    local.push(found);
    localStorage.setItem("zt_mentor_settings", JSON.stringify(local));
  }
  return found;
}

// 获取所有导师的预约开关设置
async function getAllMentorSettings() {
  if (db) {
    const { data, error } = await db
      .from("mentor_settings")
      .select("*");
    if (error) throw error;
    return data;
  }
  return JSON.parse(localStorage.getItem("zt_mentor_settings") || "[]");
}

// 创建导师设置（如果不存在）
async function createMentorSettings(mentorId) {
  var setting = {
    mentor_id: mentorId,
    booking_open: true
  };
  if (db) {
    const { data, error } = await db
      .from("mentor_settings")
      .insert(setting)
      .select();
    if (error) throw error;
    return data[0];
  }
  var local = JSON.parse(localStorage.getItem("zt_mentor_settings") || "[]");
  var record = { ...setting, id: Date.now(), updated_at: new Date().toISOString() };
  local.push(record);
  localStorage.setItem("zt_mentor_settings", JSON.stringify(local));
  return record;
}

// 更新导师预约开关（不存在则自动创建）
async function updateMentorSettings(mentorId, updates) {
  if (db) {
    const payload = { ...updates, updated_at: new Date().toISOString() };

    // 先尝试更新，如果记录不存在则插入
    const { data: updated, error: updateErr } = await db
      .from("mentor_settings")
      .update(payload)
      .eq("mentor_id", mentorId)
      .select();

    if (updateErr) throw updateErr;

    // 如果没有任何行被更新，说明记录不存在，需要创建
    if (!updated || updated.length === 0) {
      const { data: inserted, error: insertErr } = await db
        .from("mentor_settings")
        .insert({ ...payload, mentor_id: mentorId })
        .select();
      if (insertErr) throw insertErr;
      return inserted[0];
    }

    return updated[0];
  }
  var local = JSON.parse(localStorage.getItem("zt_mentor_settings") || "[]");
  var idx = local.findIndex(function(s) { return s.mentor_id === mentorId; });
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...updates, updated_at: new Date().toISOString() };
  } else {
    local.push({ mentor_id: mentorId, booking_open: true, ...updates, updated_at: new Date().toISOString() });
  }
  localStorage.setItem("zt_mentor_settings", JSON.stringify(local));
  return local[idx >= 0 ? idx : local.length - 1];
}

// ============================================
// 4. Supabase Realtime 实时订阅
// ============================================

// 订阅 appointments 表的实时更新
// onInsert: 新预约回调; onUpdate: 状态变更回调
function subscribeAppointments(callbacks) {
  if (!db) {
    console.warn("[Realtime] Supabase 未配置，无法订阅实时更新");
    // 本地模式：启动轮询模拟
    startLocalPolling(callbacks);
    return function() { stopLocalPolling(); };
  }

  callbacks = callbacks || {};

  realtimeChannel = db
    .channel("appointments-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "appointments" },
      function(payload) {
        console.log("[Realtime] 新预约:", payload.new);
        if (callbacks.onInsert) callbacks.onInsert(payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "appointments" },
      function(payload) {
        console.log("[Realtime] 预约更新:", payload.new.id, payload.new.status);
        if (callbacks.onUpdate) callbacks.onUpdate(payload.new, payload.old);
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "appointments" },
      function(payload) {
        console.log("[Realtime] 预约删除:", payload.old.id);
        if (callbacks.onDelete) callbacks.onDelete(payload.old);
      }
    )
    .subscribe(function(status) {
      console.log("[Realtime] 订阅状态:", status);
    });

  return function unsubscribe() {
    if (realtimeChannel) {
      db.removeChannel(realtimeChannel);
      realtimeChannel = null;
      console.log("[Realtime] 已取消订阅");
    }
  };
}

// 本地轮询（Supabase 未配置时的降级方案）
var localPollTimer = null;
function startLocalPolling(callbacks) {
  var lastCount = (JSON.parse(localStorage.getItem("zt_appointments") || "[]")).length;
  localPollTimer = setInterval(function() {
    var current = JSON.parse(localStorage.getItem("zt_appointments") || "[]");
    if (current.length > lastCount && callbacks.onInsert) {
      callbacks.onInsert(current[current.length - 1]);
    }
    // 检查状态变更
    current.forEach(function(a) {
      var stored = JSON.parse(localStorage.getItem("zt_appointment_" + a.id));
      if (stored && stored.status !== a.status && callbacks.onUpdate) {
        callbacks.onUpdate(a, stored);
      }
      localStorage.setItem("zt_appointment_" + a.id, JSON.stringify(a));
    });
    lastCount = current.length;
  }, 3000);
}

function stopLocalPolling() {
  if (localPollTimer) { clearInterval(localPollTimer); localPollTimer = null; }
}
