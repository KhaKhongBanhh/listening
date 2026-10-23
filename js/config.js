// ===== CẤU HÌNH CHUNG =====
const CONFIG = {
  TOTAL_EXAMS: 15,              // Số đề hiển thị ở trang chủ
  DURATION_MINUTES: 40,         // Thời gian làm bài (phút)
  DATA_FOLDER: "data",          // data/de1.json, data/de2.json, ...
  AUDIO_FOLDER: "audio",        // audio/de1/Câu 1.mp3, ...
  AUDIO_FILE_PATTERN: "Câu {n}.mp3",

  // Part 2 (câu 14): mỗi người nói 1 file riêng -> Câu 14.1.mp3 ... Câu 14.4.mp3
  // Đặt false nếu đề nào đó chỉ có 1 file Câu 14.mp3
  PART2_SPLIT_AUDIO: true
};

// Tên file audio. key có thể là 5, "14.1", ...
function audioFileName(key) {
  return CONFIG.AUDIO_FILE_PATTERN.replace("{n}", key).normalize("NFC");
}

function audioPath(examId, key) {
  return `${CONFIG.AUDIO_FOLDER}/de${examId}/${encodeURIComponent(audioFileName(key))}`;
}

function dataPath(examId) {
  return `${CONFIG.DATA_FOLDER}/de${examId}.json`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
