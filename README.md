# Aptis Listening

## Cấu trúc
```
index.html, exam.html, css/style.css
js/config.js  js/home.js  js/exam.js
data/de1.json ... deN.json
audio/de1/
   Câu 1.mp3 ... Câu 13.mp3
   Câu 14.1.mp3  Câu 14.2.mp3  Câu 14.3.mp3  Câu 14.4.mp3   <- Part 2: mỗi người nói 1 file
   Câu 15.mp3  Câu 16.mp3  Câu 17.mp3
```

## Chạy
Mở bằng Live Server (VS Code) hoặc `python -m http.server 8000` -> http://localhost:8000

## Part 2 chỉ có 1 file Câu 14.mp3?
- Cho tất cả đề: sửa `PART2_SPLIT_AUDIO: false` trong `js/config.js`
- Cho riêng 1 đề: thêm `"splitAudio": false` vào mục `"part2"` của file JSON đề đó
