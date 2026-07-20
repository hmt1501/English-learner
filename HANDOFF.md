# HANDOFF — Tiếng Anh Công Sở (ngữ cảnh cho phiên làm việc sau)

Tài liệu này tóm tắt toàn bộ ngữ cảnh code để một phiên Claude khác (hoặc lập trình viên khác) có thể tiếp nhận và sửa nhanh. Kiến trúc chi tiết xem thêm ở [AGENTS.md](AGENTS.md) (được nạp tự động mỗi phiên).

## 1. Tổng quan

- **Là gì:** PWA học tiếng Anh giao tiếp công sở cho một nhóm nhỏ nhân viên văn phòng người Việt (trình độ pre-intermediate). **UI 100% tiếng Việt**; tiếng Anh chỉ xuất hiện trong nội dung học.
- **Live:** https://hmt1501.github.io/English-learner/ · **Repo:** https://github.com/hmt1501/English-learner
- **Không backend, không đăng nhập.** Dữ liệu học lưu trên máy (IndexedDB + localStorage), có export/import JSON để sao lưu.
- **Deploy:** tự động qua GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) mỗi lần push `main` → build static export → GitHub Pages. CI đặt `NEXT_PUBLIC_BASE_PATH=/English-learner` (Pages phục vụ ở đường dẫn con).

## 2. Tech stack & lệnh

- Next.js 16 (App Router, `output: "export"`, `basePath` từ `NEXT_PUBLIC_BASE_PATH`), React 19, TypeScript, Tailwind v4.
- State: **zustand** (`src/stores/progress.ts`, persist localStorage key `tacs-progress`) + **idb-keyval** (IndexedDB, `src/lib/storage.ts`). Nội dung validate bằng **zod**.
- PWA: service worker thuần `public/sw.js` (KHÔNG dùng Serwist — Next 16 Turbopack không chạy webpack plugin).

```bash
npm run dev        # dev server
npm run build      # build production (prebuild tự chạy validate nội dung) → thư mục out/
npm test           # Vitest: src/lib/check.test.ts + src/lib/session.test.ts
npm run validate   # validate JSON trong content/ (zod, trùng id, id===topic, srsCards tồn tại)
npm run audio      # tạo MP3 còn thiếu bằng msedge-tts (incremental)
npx serve out      # xem thử bản static (next start KHÔNG chạy với output:export)
```

Kiểm tra trước khi commit: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npm test && npm run build`. ESLint dùng React Compiler rules nghiêm ngặt (không `Date.now()`/ref khi render — tính trong effect/handler; dùng `useMounted()` thay pattern setState-in-effect).

## 3. Bản đồ file

```
content/                     # Nội dung soạn sẵn (JSON), validate bằng zod
  topics.json                # 8 chủ đề (id === topic, phải trùng nhau)
  decks/<topic>.json         # 15 thẻ cụm từ/chủ đề (chunk, meaningVi, example, exampleVi, cue, cloze, audio)
  dialogues/*.json           # 6 hội thoại (lines[], questions[])
  scenarios/*.json           # 8 tình huống chat (thread, hints, modelAnswers, rubricVi, srsCards)
public/
  audio/vocab/<id>.mp3        # audio từ vựng (226 file tạo sẵn)
  audio/dialogues/<id>[-slow].mp3
  sw.js  manifest.json  icons/
scripts/
  generate-audio.mjs  validate-content.mjs  csv-to-deck.mjs
src/
  app/
    page.tsx                 # "Hôm nay": daily plan + streak (composeSession + ghim mục đã làm)
    vocab/page.tsx           # danh sách chủ đề + gợi ý hôm nay + thanh tiến độ
    vocab/study/page.tsx     # ⭐ học từ vựng: chọn 1 trong 3 chế độ (word / en2vi / vi2en), gõ đáp án + chấm
    listening/page.tsx, listening/[id]/page.tsx    # Nghe (DialoguePlayer)
    speaking/[id]/page.tsx   # Nói theo (ShadowingPlayer)
    chat/page.tsx, chat/[id]/page.tsx              # Trả lời tin nhắn (ChatScenarioPlayer)
    chat/ai/page.tsx         # ⭐ Chat với AI (Gemini)
    settings/page.tsx        # tên, số từ/buổi, API key Gemini, sao lưu/khôi phục
    layout.tsx  globals.css
  components/
    ui/ (BottomNav, PageHeader, RegisterSW)
    audio/ (AudioButton, DialoguePlayer, ShadowingPlayer)
    chat/ (ChatScenarioPlayer)
  lib/
    content.ts               # nạp tĩnh + getDeck/getCard/getDialogue/getScenario/getTopic
    content-schema.ts        # zod schemas (dùng chung app + validate script)
    check.ts (+test)         # ⭐ chấm nghĩa & dịch offline (checkMeaning/checkTranslation)
    session.ts (+test)       # ⭐ composeSession() + pickTodayTopic() (pure)
    storage.ts               # IndexedDB: WordStats, activityLog, backup
    speech.ts                # phát MP3 + fallback speechSynthesis + MediaRecorder (ghi âm)
    ai.ts                    # ⭐ gọi Gemini free tier từ trình duyệt
    useMounted.ts
  stores/progress.ts         # zustand: name, mode, wordsPerSession, streak, doneToday, todayPlanKeys, geminiKey
```

## 4. Tính năng & luồng

| Tính năng | File chính | Ghi chú |
|---|---|---|
| Hôm nay (daily plan + streak) | `app/page.tsx`, `lib/session.ts` | `composeSession()` luôn mở đầu bằng mục vocab (chủ đề gợi ý hôm nay); các mục đã làm trong ngày được **ghim** để hiện ✅ và ổn định kế hoạch. Streak cộng khi xong hết `todayPlanKeys`. |
| Từ vựng (3 chế độ) | `app/vocab/study/page.tsx`, `lib/check.ts` | Vào `/vocab/study?topic=x` → màn chọn chế độ: **word** (làm quen từ rồi gõ nghĩa tiếng Việt, chấm `checkMeaning`), **en2vi** (dịch câu ví dụ Anh→Việt, chấm `checkTranslationVi`), **vi2en** (dịch câu Việt→Anh, chấm `checkTranslation`). Chấm offline, thoáng tay, luôn hiện đáp án + có nút tự chấm lại. **Lưu `WordStats` sau mỗi câu** (cả 3 chế độ); ghi công ngày + markDone khi hoàn tất buổi ở bất kỳ chế độ nào. |
| Nghe | `components/audio/DialoguePlayer.tsx` | Phát cả bài, câu hỏi + lời thoại xem được từ đầu; hoàn thành khi trả lời hết câu hỏi. |
| Nói theo | `components/audio/ShadowingPlayer.tsx` | Ghi âm từng câu (MediaRecorder) → so với mẫu → tự chấm. |
| Trả lời tin nhắn | `components/chat/ChatScenarioPlayer.tsx` | Gõ câu trả lời → so câu mẫu + rubric tự chấm. |
| Chat với AI | `app/chat/ai/page.tsx`, `lib/ai.ts` | Roleplay đồng nghiệp ảo bằng **Google Gemini free tier**; user tự nhập API key (lưu trên máy). 6 tình huống; AI trả lời + nhận xét tiếng Việt từng câu. |
| Cài đặt | `app/settings/page.tsx` | Tên, số từ/buổi, API key Gemini, tải/khôi phục sao lưu JSON. |

## 5. Mô hình dữ liệu (lưu trên máy)

- **IndexedDB (`storage.ts`, store `tacs-db`/`tacs-store`):**
  - `wordStats: Record<key, {correct, wrong, lastSeen}>` — key theo chế độ học (`lib/vocab-modes.ts` `statKey()`): chế độ `word` dùng `cardId` trần (tương thích dữ liệu cũ), dịch câu dùng `en2vi:<cardId>` / `vi2en:<cardId>`. "Thuộc" khi `correct >= MASTER_THRESHOLD (2)`; tiến độ hiển thị ở danh sách chủ đề/màn chọn chế độ = số từ `correct >= 1` theo từng chế độ.
  - `activityLog: ActivityEntry[]` — `{date(YYYY-MM-DD local), type: "vocab"|"listening"|"shadowing"|"chat", refId?, count?, at}`.
- **localStorage (`progress.ts`, key `tacs-progress`):** name, mode(quick/full/deep), wordsPerSession, streak/bestStreak/lastStreakDate, today, doneToday[], todayPlanKeys[], seenVocabHelp, geminiKey.
- **Sao lưu** (`exportBackup`/`importBackup`): version 2 = `{wordStats, activityLog, progressStore}`. `importBackup` bỏ qua trường sai kiểu.

## 6. Quyết định & ràng buộc thiết kế (đọc trước khi sửa)

- **Static export + offline first.** Không có server code. Nếu thêm tính năng cần server (vd. giấu API key chung, route AI feedback) thì **phải chuyển host** (vd. Vercel) và bỏ `output: "export"`.
- **basePath:** mọi URL tuyệt đối tự viết phải thêm `process.env.NEXT_PUBLIC_BASE_PATH ?? ""` (xem `speech.ts`, `layout.tsx`). `sw.js` tự lấy base từ scope đăng ký.
- **AI dùng Gemini, KHÔNG dùng Claude/Anthropic:** vì web tĩnh không giấu được key trả phí; Gemini có free tier gọi trực tiếp từ trình duyệt. Key phải thuộc **project có bật free tier** (aistudio.google.com/apikey → "My First Project"), không phải project prepay không credit.
- **id ổn định:** `id` của deck/card/dialogue/scenario gắn với tên file audio và `srsCards` — **không đổi tên id cũ**. `deck.id` phải trùng `deck.topic` (validate script bắt buộc).
- **Ngày theo giờ địa phương:** streak/doneToday dùng `todayStr()` (local); `dayIndex` truyền vào `composeSession` cũng tính theo local (đã sửa lệch múi giờ).

## 7. Hành vi CỐ Ý (không phải bug)

- Thoát giữa phần kiểm tra khi chưa trả lời hết ⇒ **số từ đã học vẫn lưu** (`WordStats` lưu sau mỗi câu), nhưng ngày đó **chưa** được tính "đã học từ vựng" (chưa ghi activity/markDone). Chỉ ghi công khi hoàn tất buổi.
- **Chat với AI không nằm trong daily plan/streak** — là phần luyện thêm (log `type:"chat", refId:"ai"`, không markDone mục chat của kế hoạch).
- Chấm nghĩa/dịch **cố ý thoáng** (bỏ dấu, theo tỉ lệ từ cốt lõi) và luôn có nút tự chấm lại — không nhằm đúng từng chữ.
- Đổi mô hình dữ liệu (SRS → WordStats) khiến tiến độ từ vựng cũ trên máy bắt đầu lại; các phần khác không ảnh hưởng.

## 8. Thêm nội dung

1. Thẻ: soạn CSV (`id,chunk,meaningVi,example,exampleVi,cue,cloze`) → `node scripts/csv-to-deck.mjs <file.csv> <topic-id> "<Tiêu đề>"`.
2. Hội thoại/tình huống: copy file mẫu trong `content/dialogues|scenarios`, sửa (id duy nhất).
3. Đăng ký file mới trong `src/lib/content.ts`, rồi `npm run validate && npm run audio`.

## 9. Lịch sử thay đổi gần đây

1. MVP: SRS flashcard + nghe + nói + trả lời tin nhắn + daily plan (đã gỡ SRS ở bước 4).
2. Deploy GitHub Pages (static export + basePath + workflow).
3. Cải thiện UX ôn tập, hoàn thiện trang Nghe, thêm **Chat với AI** (Gemini); sửa lỗi 429 (thử nhiều model + hiện lỗi gốc Google).
4. **Đổi Từ vựng sang phương pháp truyền thống** (gõ nghĩa + dịch câu), bỏ SRS; **thêm bước ① Làm quen**; sửa lỗi lưu tiến độ, "plan treadmill", streak, service worker offline, múi giờ, và loạt lỗi nhỏ từ đợt review toàn app.

## 10. Gợi ý sửa lỗi thường gặp

- Lỗi tính streak/kế hoạch → xem `app/page.tsx` (ghim mục đã làm + `setTodayPlan`) và `stores/progress.ts` (`markDone`/`recordStreak`/`rollDay`).
- Chấm bài quá chặt/lỏng → chỉnh ngưỡng trong `lib/check.ts` (`checkMeaning` 0.5/0.3, `checkTranslationVi` 0.6/0.35, `checkTranslation` 0.8/0.5) và chạy `npm test`.
- Đổi độ dài buổi học → cài đặt `wordsPerSession` (dùng chung cho cả 3 chế độ trong `app/vocab/study/page.tsx`).
- AI chat lỗi → `lib/ai.ts` (danh sách `MODELS`, ánh xạ mã lỗi, prompt roleplay).
- Đổi caching/offline → `public/sw.js` (nhớ tăng `VERSION` khi đổi hành vi cache).
