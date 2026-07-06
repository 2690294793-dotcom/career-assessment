// ============================================
// 职趣星图 - 学生端逻辑
// ============================================

// 霍兰德职业兴趣类型定义
const CAREER_TYPES = {
  R: {
    code: "R",
    name: "现实型",
    color: "#dc2626",
    desc: "你喜欢动手操作、使用工具和机械，注重实践和具体成果。你擅长处理实际问题，喜欢看到看得见摸得着的结果。",
    jobs: ["工程师", "机械师", "技术员", "建筑师", "飞行员", "厨师"]
  },
  I: {
    code: "I",
    name: "研究型",
    color: "#2563eb",
    desc: "你喜欢探索和分析问题，善于逻辑推理和抽象思考。你对知识有强烈的渴求，喜欢通过研究来理解世界。",
    jobs: ["科学家", "研究员", "医生", "数据分析师", "程序员", "教授"]
  },
  A: {
    code: "A",
    name: "艺术型",
    color: "#db2777",
    desc: "你富有创造力和想象力，喜欢自由表达。你追求美感和个性，不愿受条条框框的约束，享受创作的过程。",
    jobs: ["设计师", "作家", "音乐家", "画家", "导演", "摄影师"]
  },
  S: {
    code: "S",
    name: "社会型",
    color: "#059669",
    desc: "你乐于助人，善于沟通和倾听。你关心他人的成长和福祉，喜欢通过教育、服务来影响和帮助别人。",
    jobs: ["教师", "心理咨询师", "社工", "护士", "人力资源", "培训师"]
  },
  E: {
    code: "E",
    name: "企业型",
    color: "#d97706",
    desc: "你有领导力和进取心，善于说服和影响他人。你喜欢制定目标并推动执行，享受竞争和挑战。",
    jobs: ["管理者", "销售经理", "律师", "创业者", "市场总监", "项目经理"]
  },
  C: {
    code: "C",
    name: "常规型",
    color: "#4f46e5",
    desc: "你做事有条理、注重细节，喜欢按照规则和流程工作。你善于整理信息和处理数据，是可靠的执行者。",
    jobs: ["会计", "审计师", "行政专员", "数据管理员", "银行职员", "档案管理"]
  }
};

// 测评题目（每类型4题，共24题）
const QUESTIONS = [
  // R - 现实型
  { type: "R", text: "我喜欢动手制作、修理或组装东西" },
  { type: "R", text: "我喜欢使用工具、机器或设备进行操作" },
  { type: "R", text: "我喜欢户外活动或体力劳动" },
  { type: "R", text: "我对机械、电子等技术领域感兴趣" },
  // I - 研究型
  { type: "I", text: "我喜欢探索和研究复杂的问题" },
  { type: "I", text: "我喜欢阅读科学或技术类的文章" },
  { type: "I", text: "我喜欢做实验或验证假设" },
  { type: "I", text: "我善于分析和逻辑推理" },
  // A - 艺术型
  { type: "A", text: "我喜欢创作音乐、绘画、写作等艺术作品" },
  { type: "A", text: "我喜欢自由表达自己的想法和情感" },
  { type: "A", text: "我对设计、美学有独特的见解" },
  { type: "A", text: "我喜欢在有创造性的环境中工作" },
  // S - 社会型
  { type: "S", text: "我喜欢帮助他人解决问题" },
  { type: "S", text: "我喜欢教导或培训别人" },
  { type: "S", text: "我关心他人的福祉，乐于参与公益活动" },
  { type: "S", text: "我善于倾听和与人沟通" },
  // E - 企业型
  { type: "E", text: "我喜欢领导和组织团队" },
  { type: "E", text: "我善于说服他人接受我的观点" },
  { type: "E", text: "我喜欢制定计划并推动执行" },
  { type: "E", text: "我对商业、管理和创业感兴趣" },
  // C - 常规型
  { type: "C", text: "我喜欢整理和归档资料" },
  { type: "C", text: "我做事有条理，注重细节" },
  { type: "C", text: "我喜欢按照规则和流程工作" },
  { type: "C", text: "我善于处理数据和文档" }
];

const RATING_LABELS = {
  1: "很不符合",
  2: "不符合",
  3: "一般",
  4: "比较符合",
  5: "非常符合"
};

// 状态
let currentStep = "welcome";
let currentPage = 0;       // 当前页码（每页6题，共4页）
const PAGE_SIZE = 6;
const TOTAL_PAGES = Math.ceil(QUESTIONS.length / PAGE_SIZE);
let answers = {};          // { questionIndex: rating }
let radarChart = null;

// ===== 步骤切换 =====
function goToStep(step) {
  document.querySelectorAll('[id^="step-"]').forEach(el => el.style.display = "none");
  const target = document.getElementById("step-" + step);
  if (target) target.style.display = "block";
  currentStep = step;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===== 开始测评 =====
function startAssessment() {
  const name = document.getElementById("input-name").value.trim();
  const studentId = document.getElementById("input-student-id").value.trim();
  const className = document.getElementById("input-class").value.trim();

  if (!name) return showToast("请输入姓名", "error");
  if (!studentId) return showToast("请输入学号", "error");
  if (!className) return showToast("请输入班级", "error");

  currentPage = 0;
  answers = {};
  goToStep("quiz");
  renderQuestions();
}

// ===== 渲染题目 =====
function renderQuestions() {
  const start = currentPage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, QUESTIONS.length);
  const container = document.getElementById("questions-container");

  let html = "";
  for (let i = start; i < end; i++) {
    const q = QUESTIONS[i];
    const answered = answers[i] !== undefined;

    html += `
      <div class="question-item ${answered ? 'answered' : ''}" id="q-${i}">
        <div class="question-text">
          <span class="question-number">${i + 1}</span>
          <span>${q.text}</span>
        </div>
        <div class="rating-group">
          ${Object.entries(RATING_LABELS).map(([val, label]) => `
            <div class="rating-option">
              <input type="radio" name="q-${i}" id="q-${i}-${val}" value="${val}"
                ${answers[i] == val ? 'checked' : ''}
                onchange="selectAnswer(${i}, ${val})">
              <label for="q-${i}-${val}">${val}分<br><span style="font-size:12px">${label}</span></label>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  container.innerHTML = html;

  // 更新进度
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / QUESTIONS.length) * 100;
  document.getElementById("progress-text").textContent =
    `第 ${start + 1}-${end} 题 / 共 ${QUESTIONS.length} 题`;
  document.getElementById("progress-fill").style.width = progress + "%";

  // 更新按钮
  const nextBtn = document.getElementById("next-btn");
  if (currentPage === TOTAL_PAGES - 1) {
    nextBtn.textContent = "提交测评 ✓";
  } else {
    nextBtn.textContent = "下一页 →";
  }
}

// ===== 选择答案 =====
function selectAnswer(qIndex, rating) {
  answers[qIndex] = rating;
  const item = document.getElementById("q-" + qIndex);
  if (item) item.classList.add("answered");

  // 更新进度
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / QUESTIONS.length) * 100;
  document.getElementById("progress-fill").style.width = progress + "%";
}

// ===== 上一页 =====
function prevPage() {
  if (currentPage > 0) {
    currentPage--;
    renderQuestions();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    goToStep("info");
  }
}

// ===== 下一页 / 提交 =====
async function nextPage() {
  // 检查当前页是否全部回答
  const start = currentPage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, QUESTIONS.length);
  for (let i = start; i < end; i++) {
    if (answers[i] === undefined) {
      showToast("请完成本页所有题目后再继续", "error");
      return;
    }
  }

  if (currentPage < TOTAL_PAGES - 1) {
    currentPage++;
    renderQuestions();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    // 提交测评
    await submitAssessment();
  }
}

// ===== 提交测评 =====
async function submitAssessment() {
  // 计算分数
  const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  for (let i = 0; i < QUESTIONS.length; i++) {
    scores[QUESTIONS[i].type] += answers[i] || 0;
  }

  // 排序，取前三
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topTypes = sorted.slice(0, 3).map(([type]) => type);
  const careerCode = topTypes.join("");

  // 构建数据
  const name = document.getElementById("input-name").value.trim();
  const studentId = document.getElementById("input-student-id").value.trim();
  const className = document.getElementById("input-class").value.trim();

  const submission = {
    name: name,
    student_id: studentId,
    class_name: className,
    answers: answers,
    scores: scores,
    top_types: topTypes,
    career_code: careerCode
  };

  // 提交到 Supabase
  showToast("正在提交测评结果...", "");
  try {
    await saveSubmission(submission);
    showToast("测评提交成功！", "success");
    showResult(scores, topTypes, careerCode);
  } catch (err) {
    console.error("提交失败:", err);
    showToast("提交失败，请检查网络后重试", "error");
  }
}

// ===== 显示结果 =====
function showResult(scores, topTypes, careerCode) {
  goToStep("result");

  // 职业代码
  document.getElementById("result-code").textContent = careerCode;
  const typeNames = topTypes.map(t => CAREER_TYPES[t].name).join(" · ");
  document.getElementById("result-summary").textContent =
    `你的主导类型是：${typeNames}`;

  // 雷达图
  renderRadarChart(scores);

  // 类型卡片
  const cardsContainer = document.getElementById("type-cards");
  let html = "";
  topTypes.forEach((type, idx) => {
    const info = CAREER_TYPES[type];
    const score = scores[type];
    const maxScore = 20;
    const percent = Math.round((score / maxScore) * 100);

    html += `
      <div class="type-card" style="border-left-color: ${info.color};">
        <div class="type-header">
          <div>
            <span class="badge badge-${type.toLowerCase()}">${info.code}</span>
            <span class="type-name" style="margin-left: 8px;">${info.name}</span>
            ${idx === 0 ? '<span style="color: var(--accent); font-size: 14px; margin-left: 8px;">主导类型</span>' : ''}
          </div>
          <div class="type-score" style="color: ${info.color};">${score}<span style="font-size:14px;color:var(--text-light)">/20</span></div>
        </div>
        <div class="type-desc">${info.desc}</div>
        <div class="type-jobs">
          ${info.jobs.map(job => `<span class="job-tag" style="background:${info.color}15;color:${info.color}">${job}</span>`).join('')}
        </div>
      </div>
    `;
  });
  cardsContainer.innerHTML = html;
}

// ===== 渲染雷达图 =====
function renderRadarChart(scores) {
  const ctx = document.getElementById("radar-chart").getContext("2d");

  if (radarChart) radarChart.destroy();

  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["现实型(R)", "研究型(I)", "艺术型(A)", "社会型(S)", "企业型(E)", "常规型(C)"],
      datasets: [{
        label: "你的兴趣得分",
        data: [scores.R, scores.I, scores.A, scores.S, scores.E, scores.C],
        backgroundColor: "rgba(99,102,241,0.15)",
        borderColor: "rgba(99,102,241,0.8)",
        borderWidth: 2,
        pointBackgroundColor: "#6366f1",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 20,
          ticks: { stepSize: 5, font: { size: 11 } },
          pointLabels: { font: { size: 13, weight: "600" } },
          grid: { color: "rgba(0,0,0,0.06)" },
          angleLines: { color: "rgba(0,0,0,0.06)" }
        }
      }
    }
  });
}

// ===== Toast 提示 =====
function showToast(message, type) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast show" + (type ? " " + type : "");
  setTimeout(() => {
    toast.className = "toast";
  }, 2500);
}

// ===== 初始化 =====
initSupabase();
