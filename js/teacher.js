// ============================================
// 职趣星图 - 教师端逻辑
// ============================================

var TEACHER_PASSWORD = "teacher123";

var TEST_INFO = {
  bigfive: { name: "大五人格", dims: ["O","C","E","A","N"], dimNames: {O:"开放性",C:"尽责性",E:"外向性",A:"宜人性",N:"神经质"} },
  holland: { name: "霍兰德", dims: ["R","I","A","S","E","C"], dimNames: {R:"现实型",I:"研究型",A:"艺术型",S:"社会型",E:"企业型",C:"常规型"} },
  disc: { name: "DISC", dims: ["D","I","S","C"], dimNames: {D:"支配型",I:"影响型",S:"稳健型",C:"谨慎型"} },
  mbti: { name: "MBTI", dims: ["EI","SN","TF","JP"], dimNames: {EI:"外倾/内倾",SN:"感觉/直觉",TF:"思维/情感",JP:"判断/感知"} }
};

var allData = [];

// ===== Login =====
function doLogin() {
  var pwd = document.getElementById("pwdInput").value;
  if (pwd === TEACHER_PASSWORD) {
    sessionStorage.setItem("teacher_login", "1");
    showDashboard();
  } else {
    showToast("密码错误", "error");
  }
}

function showDashboard() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  loadData();
}

// ===== Load Data =====
async function loadData() {
  var tc = document.getElementById("tableContent");
  tc.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    allData = await getAllSubmissions();
    renderStats();
    renderClassFilter();
    renderTable(allData);
  } catch(err) {
    tc.innerHTML = '<div class="empty"><div class="icon">⚠️</div><div>数据加载失败，请检查 Supabase 配置</div></div>';
  }
}

// ===== Stats =====
function renderStats() {
  var total = allData.length;
  var classes = {};
  var testCounts = {};
  var todayCount = 0;
  var today = new Date().toDateString();

  allData.forEach(function(d) {
    classes[d.class_name] = true;
    testCounts[d.test_type] = (testCounts[d.test_type] || 0) + 1;
    if (d.created_at && new Date(d.created_at).toDateString() === today) todayCount++;
  });

  var topTest = "-";
  var topCount = 0;
  for (var t in testCounts) {
    if (testCounts[t] > topCount) { topCount = testCounts[t]; topTest = TEST_INFO[t] ? TEST_INFO[t].name : t; }
  }

  document.getElementById("statsGrid").innerHTML =
    '<div class="stat-card"><div class="stat-val">'+total+'</div><div class="stat-label">总测评次数</div></div>'+
    '<div class="stat-card"><div class="stat-val">'+Object.keys(classes).length+'</div><div class="stat-label">覆盖班级</div></div>'+
    '<div class="stat-card"><div class="stat-val">'+todayCount+'</div><div class="stat-label">今日新增</div></div>'+
    '<div class="stat-card"><div class="stat-val" style="font-size:24px;">'+topTest+'</div><div class="stat-label">最多测评('+topCount+')</div></div>';
}

// ===== Class Filter =====
function renderClassFilter() {
  var classes = {};
  allData.forEach(function(d) { classes[d.class_name] = true; });
  var sel = document.getElementById("classFilter");
  var cur = sel.value;
  sel.innerHTML = '<option value="">全部班级</option>' +
    Object.keys(classes).sort().map(function(c) { return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join("");
  sel.value = cur;
}

// ===== Table =====
function renderTable(data) {
  var tc = document.getElementById("tableContent");
  if (data.length === 0) {
    tc.innerHTML = '<div class="empty"><div class="icon">📭</div><div>暂无测评数据</div><div style="font-size:13px;margin-top:8px;">学生提交测评后将在此显示</div></div>';
    return;
  }

  var html = '<table><thead><tr>'+
    '<th>姓名</th><th>学校</th><th>学号</th><th>班级</th><th>测评类型</th>'+
    '<th>结果</th><th>概述</th><th class="hide-mobile">提交时间</th><th>操作</th>'+
    '</tr></thead><tbody>';

  data.forEach(function(item, idx) {
    var testName = TEST_INFO[item.test_type] ? TEST_INFO[item.test_type].name : (item.test_name || item.test_type);
    var time = item.created_at ? new Date(item.created_at).toLocaleString("zh-CN", {month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) : "-";

    html += '<tr>'+
      '<td style="font-weight:600;">'+esc(item.name)+'</td>'+
      '<td>'+esc(item.school||'-')+'</td>'+
      '<td>'+esc(item.student_id)+'</td>'+
      '<td>'+esc(item.class_name)+'</td>'+
      '<td><span class="badge badge-'+(item.test_type||'')+'">'+esc(testName)+'</span></td>'+
      '<td><span class="result-code">'+esc(item.result_code||'-')+'</span></td>'+
      '<td style="color:var(--text-secondary);font-size:13px;">'+esc(item.result_summary||'-')+'</td>'+
      '<td class="hide-mobile" style="color:var(--text-light);font-size:13px;">'+time+'</td>'+
      '<td><button class="btn" style="padding:5px 12px;font-size:12px;" onclick="showDetail('+idx+')">查看</button></td>'+
    '</tr>';
  });

  html += '</tbody></table>';
  tc.innerHTML = html;
}

// ===== Filter =====
function filterTable() {
  var kw = (document.getElementById("searchInput").value || "").toLowerCase();
  var cf = document.getElementById("classFilter").value;
  var tf = document.getElementById("testFilter").value;

  var filtered = allData.filter(function(item) {
    var mk = !kw || (item.name||"").toLowerCase().indexOf(kw)>=0 ||
      (item.school||"").toLowerCase().indexOf(kw)>=0 ||
      (item.student_id||"").toLowerCase().indexOf(kw)>=0 ||
      (item.class_name||"").toLowerCase().indexOf(kw)>=0;
    var mc = !cf || item.class_name === cf;
    var mt = !tf || item.test_type === tf;
    return mk && mc && mt;
  });
  renderTable(filtered);
}

// ===== Detail =====
function showDetail(idx) {
  var kw = (document.getElementById("searchInput").value || "").toLowerCase();
  var cf = document.getElementById("classFilter").value;
  var tf = document.getElementById("testFilter").value;
  var filtered = allData.filter(function(item) {
    var mk = !kw || (item.name||"").toLowerCase().indexOf(kw)>=0 ||
      (item.school||"").toLowerCase().indexOf(kw)>=0 ||
      (item.student_id||"").toLowerCase().indexOf(kw)>=0 ||
      (item.class_name||"").toLowerCase().indexOf(kw)>=0;
    var mc = !cf || item.class_name === cf;
    var mt = !tf || item.test_type === tf;
    return mk && mc && mt;
  });

  var item = filtered[idx];
  if (!item) return;

  var testName = TEST_INFO[item.test_type] ? TEST_INFO[item.test_type].name : (item.test_name || item.test_type);
  var time = item.created_at ? new Date(item.created_at).toLocaleString("zh-CN") : "-";
  var info = TEST_INFO[item.test_type] || { dims: [], dimNames: {} };

  var scoresHtml = "";
  if (item.scores) {
    var sorted = info.dims.map(function(d) { return {dim:d, score:item.scores[d]||0}; })
      .sort(function(a,b) { return b.score - a.score; });
    scoresHtml = sorted.map(function(e) {
      return '<div class="score-bar-row">'+
        '<span class="score-bar-label">'+(info.dimNames[e.dim]||e.dim)+'</span>'+
        '<div class="score-bar-track"><div class="score-bar-fill" style="width:'+e.score+'%"></div></div>'+
        '<span class="score-bar-val">'+e.score+'%</span>'+
      '</div>';
    }).join("");
  }

  document.getElementById("modalBody").innerHTML =
    '<div class="detail-row"><div class="detail-label">姓名</div><div class="detail-val" style="font-weight:600;">'+esc(item.name)+'</div></div>'+
    '<div class="detail-row"><div class="detail-label">学校</div><div class="detail-val">'+esc(item.school||'-')+'</div></div>'+
    '<div class="detail-row"><div class="detail-label">学号</div><div class="detail-val">'+esc(item.student_id)+'</div></div>'+
    '<div class="detail-row"><div class="detail-label">班级</div><div class="detail-val">'+esc(item.class_name)+'</div></div>'+
    '<div class="detail-row"><div class="detail-label">测评类型</div><div class="detail-val"><span class="badge badge-'+(item.test_type||'')+'">'+esc(testName)+'</span></div></div>'+
    '<div class="detail-row"><div class="detail-label">结果代码</div><div class="detail-val" style="font-size:20px;font-weight:800;color:var(--primary);letter-spacing:2px;">'+esc(item.result_code||'-')+'</div></div>'+
    '<div class="detail-row"><div class="detail-label">概述</div><div class="detail-val">'+esc(item.result_summary||'-')+'</div></div>'+
    '<div class="detail-row"><div class="detail-label">提交时间</div><div class="detail-val" style="color:var(--text-secondary);">'+time+'</div></div>'+
    (scoresHtml ? '<div style="margin-top:20px;"><div style="font-size:14px;font-weight:700;margin-bottom:12px;">📊 各维度得分</div>'+scoresHtml+'</div>' : '')+
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">'+
      '<button class="btn" style="background:var(--red);color:#fff;padding:9px 16px;" onclick="confirmDelete('+item.id+')">🗑 删除记录</button>'+
    '</div>';

  document.getElementById("detailModal").classList.add("show");
}

function closeModal() {
  document.getElementById("detailModal").classList.remove("show");
}

async function confirmDelete(id) {
  if (!confirm("确定删除这条记录？此操作不可撤销。")) return;
  try {
    await deleteSubmission(id);
    showToast("删除成功", "success");
    closeModal();
    loadData();
  } catch(err) {
    showToast("删除失败", "error");
  }
}

// ===== Export CSV =====
function exportCSV() {
  if (allData.length === 0) { showToast("暂无数据可导出", "error"); return; }

  var headers = ["姓名","学校","学号","班级","测评类型","结果代码","概述","提交时间"];
  var rows = allData.map(function(item) {
    var testName = TEST_INFO[item.test_type] ? TEST_INFO[item.test_type].name : (item.test_name || item.test_type);
    return [
      item.name || "",
      item.school || "",
      item.student_id || "",
      item.class_name || "",
      testName,
      item.result_code || "",
      item.result_summary || "",
      item.created_at ? new Date(item.created_at).toLocaleString("zh-CN") : ""
    ];
  });

  var csv = "\uFEFF" + headers.join(",") + "\n";
  rows.forEach(function(row) {
    csv += row.map(function(cell) {
      var s = String(cell);
      if (s.indexOf(",") >= 0) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    }).join(",") + "\n";
  });

  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "职趣星图_测评数据_" + new Date().toISOString().slice(0,10) + ".csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("导出成功", "success");
}

// ===== Utils =====
function esc(str) {
  if (!str) return "";
  var d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg, type) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  setTimeout(function() { t.className = "toast"; }, 2500);
}

// ===== Init =====
initSupabase();
if (sessionStorage.getItem("teacher_login") === "1") {
  showDashboard();
}
