// ===== TRANG CHỦ: hiển thị đề 1 -> n & các chế độ đặc biệt =====
document.getElementById("durationText").textContent = CONFIG.DURATION_MINUTES;

if (location.protocol === "file:") {
  document.getElementById("fileWarning").classList.remove("hidden");
}

const grid = document.getElementById("examGrid");

function lastResultText(id) {
  try {
    const r = JSON.parse(localStorage.getItem(`aptis_listening_de${id}`));
    if (r) return `Lần gần nhất: <b>${r.score}/${r.total}</b>`;
  } catch (e) { /* ignore */ }
  return "Chưa làm";
}

// Cập nhật điểm cho Đề tổng hợp và Kiểm tra Part 4
function updateSpecialModeScores() {
  try {
    const rRandom = JSON.parse(localStorage.getItem("aptis_listening_random"));
    if (rRandom) {
      const el = document.getElementById("randomResultText");
      if (el) {
        const pct = Math.round((rRandom.score / rRandom.total) * 100);
        el.innerHTML = `Lần gần nhất: <b>${rRandom.score}/${rRandom.total}</b> (${pct}%)`;
      }
    }
  } catch (e) { /* ignore */ }

  try {
    const rPart4 = JSON.parse(localStorage.getItem("aptis_part4_test_last_result"));
    if (rPart4) {
      const el = document.getElementById("part4TestResultText");
      if (el) {
        const pct = Math.round((rPart4.score / rPart4.total) * 100);
        el.innerHTML = `Lần gần nhất: <b>${rPart4.score}/${rPart4.total}</b> (${pct}%)`;
      }
    }
  } catch (e) { /* ignore */ }
}

updateSpecialModeScores();

for (let i = 1; i <= CONFIG.TOTAL_EXAMS; i++) {
  const card = document.createElement("a");
  card.className = "exam-card loading";
  card.href = `exam.html?id=${i}`;
  card.innerHTML = `
    <div class="exam-no">${i}</div>
    <div class="exam-info">
      <div class="exam-name">Đề ${i}</div>
      <div class="exam-meta">Đang kiểm tra...</div>
    </div>`;
  grid.appendChild(card);

  fetch(dataPath(i), { cache: "no-store" })
    .then(res => {
      if (!res.ok) throw new Error("missing");
      return res.json();
    })
    .then(data => {
      card.classList.remove("loading");
      card.querySelector(".exam-name").textContent = data.title || `Đề ${i}`;
      card.querySelector(".exam-meta").innerHTML = `17 câu · ${CONFIG.DURATION_MINUTES} phút · ${lastResultText(i)}`;
    })
    .catch(() => {
      card.classList.remove("loading");
      card.classList.add("disabled");
      card.removeAttribute("href");
      card.querySelector(".exam-meta").textContent = "Chưa có dữ liệu";
    });
}
