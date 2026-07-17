# 📱 Tiếng Anh Công Sở

App học tiếng Anh giao tiếp công sở (PWA) cho người đi làm bận rộn — vốn từ yếu, nghe nói chưa tốt, cần giao tiếp và trả lời tin nhắn tiếng Anh trong công việc. Học ~20–60 phút/ngày.

**🌐 Dùng ngay: https://hmt1501.github.io/English-learner/**

Mở link trên điện thoại → menu trình duyệt → **"Thêm vào màn hình chính"** để cài như app.

## Tính năng (MVP)

| Module | Mô tả |
|---|---|
| 🏠 **Hôm nay** | Phiên học tự ghép theo quỹ thời gian (Nhanh 20' / Đủ 40' / Sâu 60') + chuỗi ngày 🔥 |
| 🃏 **Từ vựng** | 120 cụm từ công sở, 8 chủ đề, flashcard lặp lại ngắt quãng (SM-2), 3 dạng bài |
| 🎧 **Nghe** | 6 hội thoại công sở giọng neural — nghe không nhìn → câu hỏi → lời thoại + bản chậm |
| 🎤 **Nói theo** | Shadowing từng câu: nghe mẫu → ghi âm → so sánh giọng của bạn với mẫu |
| 💬 **Trả lời tin nhắn** | 8 tình huống chat kiểu Zalo — tự soạn câu trả lời, so với câu mẫu, tự chấm rubric |
| ⚙️ **Cài đặt** | Tên, giới hạn thẻ/ngày, sao lưu & khôi phục dữ liệu (file JSON) |

Dữ liệu học lưu **ngay trên thiết bị** (IndexedDB) — không cần tài khoản, không server. Hoạt động offline sau lần mở đầu tiên (PWA).

## Chạy dự án

```bash
npm install
npm run dev          # mở http://localhost:3000
```

Test trên điện thoại cùng mạng LAN: `next dev` rồi mở `http://<IP-máy-tính>:3000` (ghi âm/PWA cần HTTPS — dùng bản deploy để test đầy đủ).

```bash
npm test             # unit test SRS + session composer
npm run validate     # kiểm tra nội dung JSON
npm run build        # build production (tự validate trước)
```

## Deploy (tự động qua GitHub Pages)

Mỗi lần `git push` lên nhánh `main`, GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) tự chạy test → build static export → deploy lên **https://hmt1501.github.io/English-learner/**. Không cần server, không cần máy cá nhân mở.

Lưu ý kỹ thuật: app build với `NEXT_PUBLIC_BASE_PATH=/English-learner` trên CI vì GitHub Pages phục vụ ở đường dẫn con. Chạy local thì không cần biến này.

## Thêm nội dung mới

1. **Thẻ từ vựng**: soạn CSV trong Excel/Google Sheets với cột `id,chunk,meaningVi,example,exampleVi,cue,cloze` rồi:
   ```bash
   node scripts/csv-to-deck.mjs cards.csv <topic-id> "Tiêu đề bộ thẻ"
   ```
2. **Hội thoại / tình huống chat**: copy một file trong `content/dialogues/` hoặc `content/scenarios/` làm mẫu, sửa nội dung (id phải duy nhất).
3. Đăng ký file mới trong `src/lib/content.ts`, rồi:
   ```bash
   npm run validate     # kiểm tra lỗi
   npm run audio        # tạo file MP3 còn thiếu (cần mạng)
   ```

## Lộ trình tiếp theo

- **Phase 2**: nút "Nhận xét AI" cho câu trả lời tin nhắn (`/api/feedback`), module Mẫu câu, chấm nói bằng Web Speech, trang Tiến độ, thêm nội dung (~150 thẻ, 8 hội thoại, 12 tình huống).
- **Phase 3**: đồng bộ đa thiết bị, nhắc học hằng ngày.
