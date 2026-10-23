// ===== ÔN LUYỆN & KIỂM TRA CÂU 16, 17 (PART 4 - 60 CÂU) =====
const params = new URLSearchParams(location.search);
const mode = params.get("mode") === "test" ? "test" : "practice";

const LETTERS = ["A", "B", "C"];
const $ = (id) => document.getElementById(id);

let allQuestions = [];
let current = 0;
let answers = {};             // Dùng cho test mode: { [qId]: "A" | "B" | "C" }
let practiceAnswers = {};     // Dùng cho practice mode: { [qId]: { chosen: "A", isCorrect: true } }
let submitted = false;
let timerId = null;
let remaining = 15 * 60;      // 15 phút cho bài kiểm tra (900 giây)
let startTime = null;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- 1. TẢI DỮ LIỆU 60 CÂU ----------
fetch("data/part4_questions.json", { cache: "no-store" })
  .then(res => {
    if (!res.ok) throw new Error("Không thể tải file data/part4_questions.json");
    return res.json();
  })
  .then(data => {
    setupMode(data);
  })
  .catch(err => {
    // Fallback: nếu chưa có file json tổng hợp thì tải từ 15 đề
    loadFrom15Exams()
      .then(setupMode)
      .catch(loadErr => {
        $("part4View").innerHTML = `
          <div class="card error-card">
            <h3>Không tải được dữ liệu câu hỏi</h3>
            <p>${escapeHtml(loadErr.message)}</p>
            <a class="btn" href="index.html">Về trang chủ</a>
          </div>`;
      });
  });

function loadFrom15Exams() {
  const promises = [];
  for (let i = 1; i <= CONFIG.TOTAL_EXAMS; i++) {
    promises.push(fetch(dataPath(i), { cache: "no-store" }).then(r => r.json()));
  }
  return Promise.all(promises).then(allExams => {
    const list = [];
    let id = 1;
    allExams.forEach(e => {
      if (Array.isArray(e.part4)) {
        e.part4.forEach(p => {
          if (Array.isArray(p.questions)) {
            p.questions.forEach((q, qIdx) => {
              list.push({
                id: id++,
                examId: e.id,
                examTitle: e.title || `Đề ${e.id}`,
                passageNo: p.no,
                subNo: qIdx + 1,
                passageTitle: p.title,
                question: q.question,
                options: q.options,
                answer: q.answer,
                explain: p.explain || ""
              });
            });
          }
        });
      }
    });
    return list;
  });
}

// ---------- 2. THIẾT LẬP CHẾ ĐỘ ----------
function setupMode(data) {
  if (mode === "test") {
    document.title = "Kiểm tra các câu cuối (Part 4) - Aptis Listening";
    $("modeSubTitle").textContent = "Kiểm tra Part 4 (15 phút)";
    $("pageTitle").textContent = "Bài kiểm tra 60 câu Part 4";
    $("timerBox").classList.remove("hidden");
    $("submitBtn").classList.remove("hidden");
    $("practiceStats").classList.add("hidden");
    $("practiceProgressBar").classList.add("hidden");

    // Trộn ngẫu nhiên 60 câu hỏi
    allQuestions = shuffleArray(data).map(item => {
      const q = JSON.parse(JSON.stringify(item));
      // Trộn đáp án từng câu
      const correctText = q.options[LETTERS.indexOf(q.answer)];
      const shuffledOptions = shuffleArray(q.options);
      q.options = shuffledOptions;
      q.answer = LETTERS[shuffledOptions.indexOf(correctText)];
      return q;
    });

    startTimer();
  } else {
    // Chế độ ôn tập
    document.title = "Ôn tập các câu cuối (Part 4) - Aptis Listening";
    $("modeSubTitle").textContent = "Ôn tập Part 4";
    $("pageTitle").textContent = "Ôn tập 60 câu Part 4";
    $("timerBox").classList.add("hidden");
    $("submitBtn").classList.add("hidden");
    $("practiceStats").classList.remove("hidden");
    $("practiceProgressBar").classList.remove("hidden");

    // Giữ nguyên thứ tự câu hỏi từ Đề 1 đến Đề 15
    allQuestions = JSON.parse(JSON.stringify(data));
    updatePracticeStats();
  }

  renderQuestionNav();
  renderScreen();
}

// ---------- 3. ĐIỀU HƯỚNG CÂU HỎI ----------
function renderQuestionNav() {
  $("part4Nav").innerHTML = allQuestions.map((q, i) => {
    let cls = "";
    if (i === current) cls += " active";
    if (mode === "test") {
      if (answers[q.id]) cls += " done";
    } else {
      if (practiceAnswers[q.id]) {
        cls += practiceAnswers[q.id].isCorrect ? " done" : " wrong-nav";
      }
    }
    return `<button class="q-btn ${cls}" data-i="${i}">${i + 1}</button>`;
  }).join("");

  $("part4Nav").querySelectorAll(".q-btn").forEach(btn => {
    btn.onclick = () => goTo(+btn.dataset.i);
  });
}

function goTo(i) {
  if (i < 0 || i >= allQuestions.length) return;
  current = i;
  renderQuestionNav();
  renderScreen();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("prevBtn").onclick = () => goTo(current - 1);

// ---------- 4. RENDER MÀN HÌNH CÂU HỎI ----------
function renderScreen() {
  const q = allQuestions[current];
  $("prevBtn").disabled = current === 0;

  if (mode === "test") {
    $("nextBtn").textContent = current === allQuestions.length - 1 ? "Nộp bài ✔" : "Câu tiếp ▶";
    $("nextBtn").onclick = current === allQuestions.length - 1 ? confirmSubmit : () => goTo(current + 1);
    $("part4View").innerHTML = renderTestQuestion(q);
    bindTestInputs(q);
  } else {
    const isAnswered = !!practiceAnswers[q.id];
    $("nextBtn").textContent = current === allQuestions.length - 1 ? "Xem tổng kết ✔" : "Câu tiếp ▶";
    $("nextBtn").onclick = current === allQuestions.length - 1 ? showPracticeSummary : () => goTo(current + 1);
    $("part4View").innerHTML = renderPracticeQuestion(q);
    bindPracticeInputs(q);
    updatePracticeProgressBar();
  }
}

// Giao diện câu hỏi chế độ Kiểm tra
function renderTestQuestion(q) {
  const userAns = answers[q.id];
  return `
    <div class="card part4-card">
      <div class="part-label">Câu ${current + 1} / ${allQuestions.length} · Không dùng audio</div>
      <div class="passage-context">
        <span class="context-tag">Ngữ cảnh bài nói</span>
        <p class="context-title">${escapeHtml(q.passageTitle)}</p>
      </div>
      <p class="question-text"><span class="q-no">${current + 1}.</span> ${escapeHtml(q.question)}</p>
      <div class="options">
        ${q.options.map((opt, i) => {
          const letter = LETTERS[i];
          const checked = userAns === letter ? "checked" : "";
          return `
            <label class="option ${checked ? "selected" : ""}">
              <input type="radio" name="part4_q_${q.id}" value="${letter}" ${checked}>
              <span class="circle"></span>
              <span class="opt-text"><b>${letter}.</b> ${escapeHtml(opt)}</span>
            </label>`;
        }).join("")}
      </div>
    </div>`;
}

function bindTestInputs(q) {
  $("part4View").querySelectorAll("input[type=radio]").forEach(radio => {
    radio.addEventListener("change", (e) => {
      answers[q.id] = e.target.value;
      renderQuestionNav();
      renderScreen();
    });
  });
}

// Giao diện câu hỏi chế độ Ôn tập
function renderPracticeQuestion(q) {
  const state = practiceAnswers[q.id];
  const isAnswered = !!state;

  return `
    <div class="card part4-card practice-mode-card">
      <div class="part-label">
        Câu ${current + 1} / ${allQuestions.length} 
        <span class="source-tag">${escapeHtml(q.examTitle)} · Câu ${q.passageNo}.${q.subNo}</span>
      </div>

      <div class="passage-context">
        <span class="context-tag">Ngữ cảnh bài nói</span>
        <p class="context-title">${escapeHtml(q.passageTitle)}</p>
      </div>

      <p class="question-text"><span class="q-no">${current + 1}.</span> ${escapeHtml(q.question)}</p>

      <div class="options practice-options ${isAnswered ? "locked" : ""}">
        ${q.options.map((opt, i) => {
          const letter = LETTERS[i];
          let optCls = "";
          let badgeHtml = "";

          if (isAnswered) {
            if (letter === q.answer) {
              optCls = "opt-correct";
              badgeHtml = `<span class="opt-feedback-tag ok">✔ Đáp án đúng</span>`;
            } else if (letter === state.chosen) {
              optCls = "opt-wrong";
              badgeHtml = `<span class="opt-feedback-tag bad">✖ Bạn đã chọn</span>`;
            }
          }

          return `
            <button type="button" class="practice-opt-btn ${optCls}" data-letter="${letter}" ${isAnswered ? "disabled" : ""}>
              <span class="opt-letter">${letter}</span>
              <span class="opt-text">${escapeHtml(opt)}</span>
              ${badgeHtml}
            </button>`;
        }).join("")}
      </div>

      ${isAnswered ? `
        <div class="practice-feedback-banner ${state.isCorrect ? "feedback-ok" : "feedback-bad"}">
          <div class="feedback-title">
            ${state.isCorrect ? "🎉 Bạn đã trả lời CHÍNH XÁC!" : `💡 Chưa chính xác! Đáp án đúng là <b>${q.answer}</b>.`}
          </div>
          <div class="explain-box">
            <div class="explain-label">📝 Transcript & Lời giải chi tiết:</div>
            <div class="transcript">${escapeHtml(q.explain)}</div>
          </div>
          <div class="practice-next-action">
            <button class="btn btn-next-practice" onclick="goTo(${current + 1})">
              ${current === allQuestions.length - 1 ? "Xem kết quả ôn tập ✔" : "Sang câu tiếp theo ▶"}
            </button>
          </div>
        </div>
      ` : `
        <div class="practice-hint">💡 Hãy nhấp chọn 1 đáp án để kiểm tra đúng/sai ngay lập tức.</div>
      `}
    </div>`;
}

function bindPracticeInputs(q) {
  if (practiceAnswers[q.id]) return;

  $("part4View").querySelectorAll(".practice-opt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const chosen = btn.dataset.letter;
      const isCorrect = chosen === q.answer;
      practiceAnswers[q.id] = { chosen, isCorrect };

      updatePracticeStats();
      renderQuestionNav();
      renderScreen();
    });
  });
}

function updatePracticeStats() {
  let correctCount = 0;
  let wrongCount = 0;
  Object.values(practiceAnswers).forEach(item => {
    if (item.isCorrect) correctCount++;
    else wrongCount++;
  });

  $("statCorrect").textContent = correctCount;
  $("statWrong").textContent = wrongCount;
  $("statProgress").textContent = `${current + 1}/${allQuestions.length}`;
}

function updatePracticeProgressBar() {
  const percent = Math.round(((current + 1) / allQuestions.length) * 100);
  $("progressFill").style.width = `${percent}%`;
}

function showPracticeSummary() {
  let correctCount = 0;
  let wrongCount = 0;
  Object.values(practiceAnswers).forEach(item => {
    if (item.isCorrect) correctCount++;
    else wrongCount++;
  });

  const total = allQuestions.length;
  const answered = Object.keys(practiceAnswers).length;
  const percent = Math.round((correctCount / total) * 100);

  ["part4View", "navButtons", "part4Nav", "practiceStats", "practiceProgressBar"].forEach(id => $(id).classList.add("hidden"));
  $("resultView").classList.remove("hidden");
  $("resultView").innerHTML = `
    <div class="card result-summary">
      <h2>Tổng kết Ôn tập – Part 4 (60 câu)</h2>
      <div class="score-circle" style="--p:${percent}">
        <div><span class="score-line"><b>${correctCount}</b>/${total}</span><small>${percent}%</small></div>
      </div>
      <div class="part-scores">
        <div class="part-score"><span>Đã trả lời</span><b>${answered}/${total}</b></div>
        <div class="part-score"><span>Số câu đúng</span><b style="color:var(--green)">${correctCount}</b></div>
        <div class="part-score"><span>Số câu sai</span><b style="color:var(--wrong)">${wrongCount}</b></div>
      </div>
      <div class="result-actions">
        <button class="btn" onclick="location.reload()">Ôn tập lại từ đầu 🔄</button>
        <a class="btn" style="background:#4f46e5" href="part4.html?mode=test">Làm bài kiểm tra 15 phút ⏱️</a>
        <a class="btn btn-outline" href="index.html">Về trang chủ ⌂</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0 });
}

// ---------- 5. ĐỒNG HỒ ĐẾM NGƯỢC (TEST MODE) ----------
function startTimer() {
  startTime = Date.now();
  updateTimerUI();
  timerId = setInterval(() => {
    remaining--;
    updateTimerUI();
    if (remaining <= 0) {
      clearInterval(timerId);
      alert("Hết 15 phút làm bài! Hệ thống tự động nộp bài.");
      submitTest();
    }
  }, 1000);
}

function updateTimerUI() {
  const m = Math.max(0, Math.floor(remaining / 60));
  const s = Math.max(0, remaining % 60);
  $("mins").textContent = String(m).padStart(2, "0");
  $("secs").textContent = String(s).padStart(2, "0");
  $("timerBox").classList.toggle("danger", remaining <= 180);
}

// ---------- 6. NỘP BÀI KIỂM TRA (TEST MODE) ----------
$("submitBtn").onclick = confirmSubmit;

function countUnanswered() {
  let done = 0;
  allQuestions.forEach(q => {
    if (answers[q.id]) done++;
  });
  return allQuestions.length - done;
}

function confirmSubmit() {
  if (submitted) return;
  const left = countUnanswered();
  const msg = left > 0
    ? `Bạn còn ${left} câu chưa làm. Bạn có chắc muốn nộp bài?`
    : "Bạn có chắc muốn nộp bài kiểm tra?";
  if (confirm(msg)) submitTest();
}

function submitTest() {
  if (submitted) return;
  submitted = true;
  clearInterval(timerId);

  let score = 0;
  allQuestions.forEach(q => {
    if (answers[q.id] === q.answer) score++;
  });

  const total = allQuestions.length;
  const timeUsedSecs = 15 * 60 - remaining;
  const usedMins = Math.floor(timeUsedSecs / 60);
  const usedSecs = timeUsedSecs % 60;
  const timeText = `${usedMins} phút ${usedSecs} giây`;

  localStorage.setItem("aptis_part4_test_last_result", JSON.stringify({
    score, total, timeText, date: new Date().toISOString()
  }));

  ["part4View", "navButtons", "part4Nav", "submitBtn", "timerBox"].forEach(id => $(id).classList.add("hidden"));
  $("resultView").classList.remove("hidden");
  $("resultView").innerHTML = renderTestResult(score, total, timeText);
  window.scrollTo({ top: 0 });
}

function renderTestResult(score, total, timeText) {
  const percent = Math.round((score / total) * 100);
  let wrongCount = 0;
  let skipCount = 0;
  allQuestions.forEach(q => {
    const user = answers[q.id];
    if (!user) skipCount++;
    else if (user !== q.answer) wrongCount++;
  });

  let html = `
    <div class="card result-summary">
      <h2>Kết quả Kiểm tra Part 4 (60 câu)</h2>
      <div class="score-circle" style="--p:${percent}">
        <div><span class="score-line"><b>${score}</b>/${total}</span><small>${percent}%</small></div>
      </div>
      <div class="part-scores">
        <div class="part-score"><span>Số câu đúng</span><b style="color:var(--green)">${score}</b></div>
        <div class="part-score"><span>Số câu sai</span><b style="color:var(--wrong)">${wrongCount}</b></div>
        <div class="part-score"><span>Bỏ trống</span><b style="color:var(--muted)">${skipCount}</b></div>
        <div class="part-score"><span>Thời gian làm</span><b>${timeText}</b></div>
      </div>
      <div class="result-actions">
        <button class="btn" onclick="location.reload()">Làm lại bài mới (trộn lại) 🎲</button>
        <a class="btn" style="background:#0284c7" href="part4.html?mode=practice">Chuyển sang Ôn tập 60 câu 📚</a>
        <a class="btn btn-outline" href="index.html">Về trang chủ ⌂</a>
      </div>
    </div>
    <h2 class="section-title">Đáp án chi tiết</h2>`;

  allQuestions.forEach((q, i) => {
    const user = answers[q.id];
    let badge = `<span class="badge ok">Đúng</span>`;
    if (!user) badge = `<span class="badge skip">Bỏ trống</span>`;
    else if (user !== q.answer) badge = `<span class="badge bad">Sai</span>`;

    html += `
      <div class="card review-card">
        <div class="review-head">
          <span><b>Câu ${i + 1}.</b> ${escapeHtml(q.question)}</span>
          ${badge}
        </div>
        <div class="passage-context small">
          <span class="context-tag">Ngữ cảnh</span> ${escapeHtml(q.passageTitle)}
        </div>
        <div class="options review">
          ${q.options.map((opt, optIdx) => {
            const letter = LETTERS[optIdx];
            let cls = "";
            if (letter === q.answer) cls = "correct";
            else if (letter === user) cls = "wrong";
            return `
              <div class="option ${cls}">
                <span class="circle ${letter === user ? "filled" : ""}"></span>
                <span class="opt-text"><b>${letter}.</b> ${escapeHtml(opt)}</span>
                ${letter === q.answer ? `<span class="tag">Đáp án</span>` : ""}
                ${letter === user && letter !== q.answer ? `<span class="tag">Bạn chọn</span>` : ""}
              </div>`;
          }).join("")}
        </div>
        <details class="explain">
          <summary>Xem transcript & giải thích</summary>
          <div class="transcript">${escapeHtml(q.explain)}</div>
        </details>
      </div>`;
  });

  return html;
}

window.addEventListener("beforeunload", (e) => {
  if (mode === "test" && !submitted && Object.keys(answers).length > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
});
