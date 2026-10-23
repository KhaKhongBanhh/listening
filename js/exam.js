// ===== TRANG LÀM BÀI =====
const params = new URLSearchParams(location.search);
const idParam = params.get("id");
const isRandom = idParam === "random";
const examId = isRandom ? "random" : (parseInt(idParam, 10) || 1);

let exam = null;
let screens = [];
let current = 0;
let answers = {};
let submitted = false;
let remaining = CONFIG.DURATION_MINUTES * 60;
let timerId = null;

const LETTERS = ["A", "B", "C"];
const PART3_CHOICES = ["Man", "Woman", "Both"];

const $ = (id) => document.getElementById(id);

// Hàm trộn ngẫu nhiên mảng (Fisher-Yates)
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Part 2 có tách file audio theo từng người nói không?
// Ưu tiên cấu hình trong JSON ("splitAudio": false), nếu không có thì theo CONFIG.
function part2Split() {
  if (exam && exam.part2 && typeof exam.part2.splitAudio === "boolean") return exam.part2.splitAudio;
  return CONFIG.PART2_SPLIT_AUDIO;
}

// ---------- 1. TẢI ĐỀ HOẶC TẠO ĐỀ TỔNG HỢP ----------
if (isRandom) {
  loadRandomExam()
    .then(initExam)
    .catch(handleLoadError);
} else {
  fetch(dataPath(examId), { cache: "no-store" })
    .then(res => {
      if (!res.ok) throw new Error(`Không tìm thấy file ${dataPath(examId)}`);
      return res.json();
    })
    .then(initExam)
    .catch(handleLoadError);
}

// Tạo đề tổng hợp ngẫu nhiên từ 15 đề đã biết
function loadRandomExam() {
  const promises = [];
  for (let i = 1; i <= CONFIG.TOTAL_EXAMS; i++) {
    promises.push(
      fetch(dataPath(i), { cache: "no-store" }).then(res => {
        if (!res.ok) throw new Error(`Không tìm thấy file ${dataPath(i)}`);
        return res.json();
      })
    );
  }

  return Promise.all(promises).then(allExams => {
    // 1. Part 1 (câu 1 đến 13): lấy ngẫu nhiên 13 câu từ pool tất cả câu Part 1 của 15 đề
    const poolPart1 = [];
    allExams.forEach(e => {
      if (Array.isArray(e.part1)) {
        e.part1.forEach(q => {
          poolPart1.push({
            ...q,
            sourceExamId: e.id,
            sourceNo: q.no
          });
        });
      }
    });

    const chosenP1 = shuffleArray(poolPart1).slice(0, 13);
    const part1 = chosenP1.map((item, idx) => {
      const q = JSON.parse(JSON.stringify(item));
      q.no = idx + 1;
      q.audioExamId = item.sourceExamId;
      q.audioKey = item.sourceNo;

      // Đảo đáp án câu 1 đến 13
      const correctText = q.options[LETTERS.indexOf(q.answer)];
      const shuffledOptions = shuffleArray(q.options);
      q.options = shuffledOptions;
      q.answer = LETTERS[shuffledOptions.indexOf(correctText)];
      return q;
    });

    // 2. Part 2 (câu 14): chọn ngẫu nhiên câu 14 của 1 đề
    const p2Exam = allExams[Math.floor(Math.random() * allExams.length)];
    const part2 = JSON.parse(JSON.stringify(p2Exam.part2));
    part2.no = 14;
    part2.audioExamId = p2Exam.id;
    // Đảo đáp án câu 14 (đảo danh sách lựa chọn trong dropdown)
    part2.options = shuffleArray(part2.options);

    // 3. Part 3 (câu 15): chọn ngẫu nhiên câu 15 của 1 đề
    const p3Exam = allExams[Math.floor(Math.random() * allExams.length)];
    const part3 = JSON.parse(JSON.stringify(p3Exam.part3));
    part3.no = 15;
    part3.audioExamId = p3Exam.id;

    // 4. Part 4 (câu 16 & 17): chọn ngẫu nhiên câu 16 và câu 17
    const p4aExam = allExams[Math.floor(Math.random() * allExams.length)];
    const q16 = JSON.parse(JSON.stringify(p4aExam.part4[0]));
    q16.no = 16;
    q16.audioExamId = p4aExam.id;
    q16.audioKey = 16;

    const remainingExams = allExams.filter(e => e.id !== p4aExam.id);
    const p4bExam = (remainingExams.length > 0 ? remainingExams : allExams)[Math.floor(Math.random() * (remainingExams.length || allExams.length))];
    const q17 = JSON.parse(JSON.stringify(p4bExam.part4[1]));
    q17.no = 17;
    q17.audioExamId = p4bExam.id;
    q17.audioKey = 17;

    return {
      id: "random",
      title: "Đề tổng hợp ngẫu nhiên",
      isRandom: true,
      part1,
      part2,
      part3,
      part4: [q16, q17]
    };
  });
}

function initExam(data) {
  exam = data;
  exam.id = exam.id || examId;
  document.title = `${exam.title} - Aptis Listening`;
  $("examTitle").textContent = exam.title;
  buildScreens();
  renderPartNav();
  renderScreen();
  startTimer();
}

function handleLoadError(err) {
  const isFile = location.protocol === "file:";
  $("examView").innerHTML = `
    <div class="card error-card">
      <h3>Không tải được đề thi</h3>
      <p>${escapeHtml(err.message)}</p>
      ${isFile ? `<p>Bạn đang mở bằng <code>file://</code>. Hãy mở dự án bằng <b>Live Server</b> (VS Code) hoặc <code>python -m http.server</code>.</p>` : ""}
      <a class="btn" href="index.html">Về trang chủ</a>
    </div>`;
  $("navButtons").classList.add("hidden");
  $("submitBtn").classList.add("hidden");
}

// ---------- 2. DỰNG DANH SÁCH MÀN HÌNH ----------
function buildScreens() {
  screens = [];
  exam.part1.forEach(q => screens.push({ part: 1, no: q.no, data: q }));
  screens.push({ part: 2, no: exam.part2.no, data: exam.part2 });
  screens.push({ part: 3, no: exam.part3.no, data: exam.part3 });
  exam.part4.forEach(q => screens.push({ part: 4, no: q.no, data: q }));
}

function screenStatus(s) {
  if (s.part === 1) return answers[`q${s.no}`] ? "done" : "";
  let n = 0;
  if (s.part === 2) n = s.data.speakers.length;
  if (s.part === 3) n = s.data.statements.length;
  if (s.part === 4) n = s.data.questions.length;
  let filled = 0;
  for (let i = 0; i < n; i++) if (answers[`q${s.no}-${i}`]) filled++;
  if (filled === 0) return "";
  return filled === n ? "done" : "partial";
}

// ---------- 3. THANH ĐIỀU HƯỚNG ----------
function renderPartNav() {
  const parts = [
    { p: 1, label: "Part 1", sub: "Câu 1–13" },
    { p: 2, label: "Part 2", sub: "Câu 14" },
    { p: 3, label: "Part 3", sub: "Câu 15" },
    { p: 4, label: "Part 4", sub: "Câu 16–17" }
  ];
  const activePart = screens[current].part;
  $("partNav").innerHTML = parts.map(x => `
    <button class="part-tab ${x.p === activePart ? "active" : ""}" data-part="${x.p}">
      ${x.label}<small>${x.sub}</small>
    </button>`).join("");
  $("partNav").querySelectorAll(".part-tab").forEach(btn => {
    btn.onclick = () => goTo(screens.findIndex(s => s.part === +btn.dataset.part));
  });

  $("questionNav").innerHTML = screens.map((s, i) => `
    <button class="q-btn ${i === current ? "active" : ""} ${screenStatus(s)}" data-i="${i}">${s.no}</button>
  `).join("");
  $("questionNav").querySelectorAll(".q-btn").forEach(btn => {
    btn.onclick = () => goTo(+btn.dataset.i);
  });
}

function goTo(i) {
  if (i < 0 || i >= screens.length) return;
  stopAllAudio();
  current = i;
  renderPartNav();
  renderScreen();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("prevBtn").onclick = () => goTo(current - 1);

function stopAllAudio() {
  document.querySelectorAll("audio").forEach(a => a.pause());
}

// Khi 1 audio bắt đầu phát -> dừng các audio khác (tránh 2 file 14.x phát cùng lúc)
document.addEventListener("play", (e) => {
  document.querySelectorAll("audio").forEach(a => { if (a !== e.target) a.pause(); });
}, true);

// ---------- 4. AUDIO ----------
// key: số câu (5) hoặc chuỗi "14.1"
function audioBlock(key, compact = false, sourceExamId = null) {
  const exId = sourceExamId || (exam && exam.id);
  const src = audioPath(exId, key);
  return `
    <div class="audio-bar ${compact ? "compact" : ""}">
      <audio controls preload="metadata" src="${src}"
        onerror="this.parentElement.classList.add('missing')"></audio>
      <div class="audio-missing">⚠️ Chưa có file: <code>${CONFIG.AUDIO_FOLDER}/de${exId}/${escapeHtml(audioFileName(key))}</code></div>
    </div>`;
}

// Key audio cho từng người nói ở Part 2: "14.1", "14.2", ...
function part2AudioKey(i) {
  return `${exam.part2.no}.${i + 1}`;
}

// ---------- 5. RENDER ----------
function renderScreen() {
  const s = screens[current];
  let html = "";
  if (s.part === 1) html = renderPart1(s.data);
  if (s.part === 2) html = renderPart2(s.data);
  if (s.part === 3) html = renderPart3(s.data);
  if (s.part === 4) html = renderPart4(s.data);
  $("examView").innerHTML = html;

  $("prevBtn").disabled = current === 0;
  const isLast = current === screens.length - 1;
  $("nextBtn").textContent = isLast ? "Nộp bài ✔" : "Câu tiếp ▶";
  $("nextBtn").onclick = isLast ? confirmSubmit : () => goTo(current + 1);

  bindInputs();
}

function renderPart1(q) {
  const key = `q${q.no}`;
  const exId = q.audioExamId || exam.id;
  const audioKey = q.audioKey || q.no;
  const sourceBadge = q.sourceExamId ? `<span class="source-tag">Từ Đề ${q.sourceExamId} · Câu ${q.sourceNo}</span>` : "";

  return `
    <div class="card">
      <div class="part-label">Part 1 · Question ${q.no} of 17 ${sourceBadge}</div>
      ${audioBlock(audioKey, false, exId)}
      <p class="question-text"><span class="q-no">${q.no}.</span> ${escapeHtml(q.question)}</p>
      <div class="options">
        ${q.options.map((opt, i) => radioOption(key, LETTERS[i], opt)).join("")}
      </div>
    </div>`;
}

function radioOption(key, letter, text) {
  const checked = answers[key] === letter ? "checked" : "";
  return `
    <label class="option">
      <input type="radio" name="${key}" value="${letter}" data-key="${key}" ${checked}>
      <span class="circle"></span>
      <span class="opt-text">${escapeHtml(text)}</span>
    </label>`;
}

// Part 2: mỗi người nói có 1 audio riêng (Câu 14.1 -> 14.4) + 1 ô chọn
function renderPart2(q) {
  const split = part2Split();
  const stem = q.stem ? ` ${escapeHtml(q.stem)}` : "";
  const exId = q.audioExamId || exam.id;
  const sourceBadge = q.audioExamId ? `<span class="source-tag">Từ Đề ${q.audioExamId}</span>` : "";

  return `
    <div class="card">
      <div class="part-label">Part 2 · Question ${q.no} ${sourceBadge}</div>
      ${split ? `<div class="audio-spacer"></div>` : audioBlock(q.no, false, exId)}
      <p class="question-text"><span class="q-no">${q.no}.</span> ${escapeHtml(q.title)}</p>
      <div class="p2-rows ${split ? "split" : ""}">
        ${q.speakers.map((sp, i) => {
          const key = `q${q.no}-${i}`;
          return `
          <div class="p2-item">
            <div class="p2-row">
              <span class="p2-letter">${String.fromCharCode(97 + i)}</span>
              <span class="p2-speaker">${escapeHtml(sp)}${stem}</span>
              <select data-key="${key}">
                <option value="">— Chọn —</option>
                ${q.options.map((opt, j) => `<option value="${escapeHtml(opt)}" ${answers[key] === opt ? "selected" : ""}>${j + 1}. ${escapeHtml(opt)}</option>`).join("")}
              </select>
            </div>
            ${split ? audioBlock(part2AudioKey(i), true, exId) : ""}
          </div>`;
        }).join("")}
      </div>
      <ol class="p2-options">
        ${q.options.map(opt => `<li>${escapeHtml(opt)}</li>`).join("")}
      </ol>
    </div>`;
}

function renderPart3(q) {
  const exId = q.audioExamId || exam.id;
  const sourceBadge = q.audioExamId ? `<span class="source-tag">Từ Đề ${q.audioExamId}</span>` : "";

  return `
    <div class="card">
      <div class="part-label">Part 3 · Question ${q.no} ${sourceBadge}</div>
      ${audioBlock(q.no, false, exId)}
      <p class="question-text"><span class="q-no">${q.no}.</span> ${escapeHtml(q.title)}</p>
      <h3 class="sub-title">Who expresses which opinion?</h3>
      <div class="p3-rows">
        ${q.statements.map((st, i) => {
          const key = `q${q.no}-${i}`;
          return `
          <div class="p3-row">
            <span class="p3-text"><b>${q.no}.${i + 1}</b> ${escapeHtml(st.text)}</span>
            <select data-key="${key}">
              <option value=""></option>
              ${PART3_CHOICES.map(c => `<option value="${c}" ${answers[key] === c ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

function renderPart4(q) {
  const exId = q.audioExamId || exam.id;
  const audioKey = q.audioKey || q.no;
  const sourceBadge = q.audioExamId ? `<span class="source-tag">Từ Đề ${q.audioExamId}</span>` : "";

  return `
    <div class="card">
      <div class="part-label">Part 4 · Question ${q.no} ${sourceBadge}</div>
      ${audioBlock(audioKey, false, exId)}
      <p class="question-text">${escapeHtml(q.title)}</p>
      ${q.questions.map((sub, i) => {
        const key = `q${q.no}-${i}`;
        return `
        <div class="p4-sub">
          <p class="p4-question"><b>${q.no}.${i + 1}</b> ${escapeHtml(sub.question)}</p>
          <div class="options">
            ${sub.options.map((opt, j) => radioOption(key, LETTERS[j], opt)).join("")}
          </div>
        </div>`;
      }).join("")}
    </div>`;
}

function bindInputs() {
  $("examView").querySelectorAll("input[type=radio], select").forEach(el => {
    el.addEventListener("change", () => {
      const key = el.dataset.key;
      if (el.value) answers[key] = el.value;
      else delete answers[key];
      renderPartNav();
    });
  });
}

// ---------- 6. ĐỒNG HỒ ----------
function startTimer() {
  updateTimer();
  timerId = setInterval(() => {
    remaining--;
    updateTimer();
    if (remaining <= 0) {
      clearInterval(timerId);
      alert("Hết giờ! Hệ thống tự động nộp bài.");
      submitExam();
    }
  }, 1000);
}

function updateTimer() {
  const m = Math.max(0, Math.floor(remaining / 60));
  const s = Math.max(0, remaining % 60);
  $("mins").textContent = String(m).padStart(2, "0");
  $("secs").textContent = String(s).padStart(2, "0");
  $("timerBox").classList.toggle("danger", remaining <= 300);
}

$("toggleTimer").onclick = () => {
  const box = $("timerBox");
  box.classList.toggle("timer-hidden");
  $("toggleTimer").innerHTML = box.classList.contains("timer-hidden") ? "Show<br>time" : "Hide<br>time";
};

// ---------- 7. NỘP BÀI ----------
$("submitBtn").onclick = confirmSubmit;

function countUnanswered() {
  let total = 0, done = 0;
  screens.forEach(s => {
    if (s.part === 1) { total++; if (answers[`q${s.no}`]) done++; }
    else {
      const n = s.part === 2 ? s.data.speakers.length : s.part === 3 ? s.data.statements.length : s.data.questions.length;
      for (let i = 0; i < n; i++) { total++; if (answers[`q${s.no}-${i}`]) done++; }
    }
  });
  return total - done;
}

function confirmSubmit() {
  if (submitted) return;
  const left = countUnanswered();
  const msg = left > 0
    ? `Bạn còn ${left} ý chưa trả lời. Bạn có chắc muốn nộp bài?`
    : "Bạn có chắc muốn nộp bài?";
  if (confirm(msg)) submitExam();
}

function submitExam() {
  if (submitted) return;
  submitted = true;
  clearInterval(timerId);
  stopAllAudio();

  const result = gradeExam();
  const storageKey = exam.isRandom ? "aptis_listening_random" : `aptis_listening_de${exam.id}`;
  localStorage.setItem(storageKey, JSON.stringify({
    score: result.score, total: result.total, date: new Date().toISOString()
  }));

  ["examView", "navButtons", "partNav", "questionNav", "submitBtn"].forEach(id => $(id).classList.add("hidden"));
  $("resultView").classList.remove("hidden");
  $("resultView").innerHTML = renderResult(result);
  window.scrollTo({ top: 0 });
}

// ---------- 8. CHẤM ĐIỂM ----------
function gradeExam() {
  const parts = { 1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0] };
  const add = (p, ok) => { parts[p][1]++; if (ok) parts[p][0]++; };

  exam.part1.forEach(q => add(1, answers[`q${q.no}`] === q.answer));
  exam.part2.answers.forEach((a, i) => add(2, answers[`q${exam.part2.no}-${i}`] === a));
  exam.part3.statements.forEach((st, i) => add(3, answers[`q${exam.part3.no}-${i}`] === st.answer));
  exam.part4.forEach(q => q.questions.forEach((sub, i) => add(4, answers[`q${q.no}-${i}`] === sub.answer)));

  const score = Object.values(parts).reduce((s, p) => s + p[0], 0);
  const total = Object.values(parts).reduce((s, p) => s + p[1], 0);
  return { parts, score, total };
}

// ---------- 9. KẾT QUẢ + ĐÁP ÁN ----------
function statusBadge(user, correct) {
  if (!user) return `<span class="badge skip">Bỏ trống</span>`;
  return user === correct ? `<span class="badge ok">Đúng</span>` : `<span class="badge bad">Sai</span>`;
}

function explainBlock(key, text, label = "Nghe lại & xem transcript", sourceExamId = null) {
  return `
    <details class="explain">
      <summary>${escapeHtml(label)}</summary>
      ${audioBlock(key, true, sourceExamId)}
      <div class="transcript">${escapeHtml(text)}</div>
    </details>`;
}

function reviewOptions(key, options, correctLetter) {
  const user = answers[key];
  return `<div class="options review">
    ${options.map((opt, i) => {
      const l = LETTERS[i];
      let cls = "";
      if (l === correctLetter) cls = "correct";
      else if (l === user) cls = "wrong";
      return `<div class="option ${cls}">
        <span class="circle ${l === user ? "filled" : ""}"></span>
        <span class="opt-text">${escapeHtml(opt)}</span>
        ${l === correctLetter ? `<span class="tag">Đáp án</span>` : ""}
        ${l === user && l !== correctLetter ? `<span class="tag">Bạn chọn</span>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

function renderResult(r) {
  const percent = Math.round((r.score / r.total) * 100);

  let html = `
    <div class="card result-summary">
      <h2>Kết quả – ${escapeHtml(exam.title)}</h2>
      <div class="score-circle" style="--p:${percent}">
        <div><span class="score-line"><b>${r.score}</b>/${r.total}</span><small>${percent}%</small></div>
      </div>
      <div class="part-scores">
        ${Object.entries(r.parts).map(([p, v]) => `
          <div class="part-score"><span>Part ${p}</span><b>${v[0]}/${v[1]}</b></div>`).join("")}
      </div>
      <div class="result-actions">
        <button class="btn" onclick="location.reload()">${exam.isRandom ? "Làm đề tổng hợp khác 🎲" : "Làm lại"}</button>
        <a class="btn btn-outline" href="index.html">Về trang chủ</a>
      </div>
    </div>
    <h2 class="section-title">Đáp án chi tiết</h2>`;

  // Part 1
  html += `<h3 class="review-part">Part 1 – Câu 1 đến 13</h3>`;
  exam.part1.forEach(q => {
    const key = `q${q.no}`;
    const exId = q.audioExamId || exam.id;
    const audioKey = q.audioKey || q.no;
    const sourceTag = q.sourceExamId ? ` <span class="source-tag">Từ Đề ${q.sourceExamId} · Câu ${q.sourceNo}</span>` : "";

    html += `
      <div class="card review-card">
        <div class="review-head"><span><b>${q.no}.</b> ${escapeHtml(q.question)}${sourceTag}</span>${statusBadge(answers[key], q.answer)}</div>
        ${reviewOptions(key, q.options, q.answer)}
        ${explainBlock(audioKey, q.explain, "Nghe lại & xem transcript", exId)}
      </div>`;
  });

  // Part 2
  const p2 = exam.part2;
  const split = part2Split();
  const explains = p2.explain || [];
  const p2ExId = p2.audioExamId || exam.id;
  const p2Tag = p2.audioExamId ? ` <span class="source-tag">Từ Đề ${p2.audioExamId}</span>` : "";

  html += `<h3 class="review-part">Part 2 – Câu ${p2.no}${p2Tag}</h3>
    <div class="card review-card">
      <div class="review-head"><span><b>${p2.no}.</b> ${escapeHtml(p2.title)}</span></div>
      <table class="review-table">
        <thead><tr><th>Người nói</th><th>Bạn chọn</th><th>Đáp án</th><th></th></tr></thead>
        <tbody>
        ${p2.speakers.map((sp, i) => {
          const u = answers[`q${p2.no}-${i}`];
          return `<tr class="${u === p2.answers[i] ? "row-ok" : "row-bad"}">
            <td>${escapeHtml(sp)}</td><td>${escapeHtml(u || "—")}</td>
            <td><b>${escapeHtml(p2.answers[i])}</b></td><td>${statusBadge(u, p2.answers[i])}</td></tr>`;
        }).join("")}
        </tbody>
      </table>
      ${split
        ? p2.speakers.map((sp, i) => explainBlock(part2AudioKey(i), explains[i] || "", `${sp} – nghe lại & xem transcript`, p2ExId)).join("")
        : explainBlock(p2.no, explains.join("\n\n"), "Nghe lại & xem transcript", p2ExId)}
    </div>`;

  // Part 3
  const p3 = exam.part3;
  const p3ExId = p3.audioExamId || exam.id;
  const p3Tag = p3.audioExamId ? ` <span class="source-tag">Từ Đề ${p3.audioExamId}</span>` : "";

  html += `<h3 class="review-part">Part 3 – Câu ${p3.no}${p3Tag}</h3>
    <div class="card review-card">
      <div class="review-head"><span><b>${p3.no}.</b> ${escapeHtml(p3.title)}</span></div>
      <table class="review-table">
        <thead><tr><th>Ý kiến</th><th>Bạn chọn</th><th>Đáp án</th><th></th></tr></thead>
        <tbody>
        ${p3.statements.map((st, i) => {
          const u = answers[`q${p3.no}-${i}`];
          return `<tr class="${u === st.answer ? "row-ok" : "row-bad"}">
            <td><b>${p3.no}.${i + 1}</b> ${escapeHtml(st.text)}</td><td>${escapeHtml(u || "—")}</td>
            <td><b>${escapeHtml(st.answer)}</b></td><td>${statusBadge(u, st.answer)}</td></tr>`;
        }).join("")}
        </tbody>
      </table>
      ${explainBlock(p3.no, p3.explain, "Nghe lại & xem transcript", p3ExId)}
    </div>`;

  // Part 4
  html += `<h3 class="review-part">Part 4 – Câu 16 & 17</h3>`;
  exam.part4.forEach(q => {
    const p4ExId = q.audioExamId || exam.id;
    const audioKey = q.audioKey || q.no;
    const p4Tag = q.audioExamId ? ` <span class="source-tag">Từ Đề ${q.audioExamId}</span>` : "";

    html += `
      <div class="card review-card">
        <div class="review-head"><span><b>${q.no}.</b> ${escapeHtml(q.title)}${p4Tag}</span></div>
        ${q.questions.map((sub, i) => {
          const key = `q${q.no}-${i}`;
          return `
            <div class="p4-sub">
              <div class="review-head"><span><b>${q.no}.${i + 1}</b> ${escapeHtml(sub.question)}</span>${statusBadge(answers[key], sub.answer)}</div>
              ${reviewOptions(key, sub.options, sub.answer)}
            </div>`;
        }).join("")}
        ${explainBlock(audioKey, q.explain, "Nghe lại & xem transcript", p4ExId)}
      </div>`;
  });

  return html;
}

window.addEventListener("beforeunload", (e) => {
  if (!submitted && Object.keys(answers).length > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
});
