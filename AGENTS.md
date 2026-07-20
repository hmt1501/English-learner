<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tiếng Anh Công Sở — Workplace English PWA

English-learning PWA for a small group of Vietnamese office workers (pre-intermediate level). UI is 100% Vietnamese; English appears only in learning content. No backend, no auth — all learner data lives on-device (IndexedDB + localStorage) with JSON export/import backup in Settings.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (runs `prebuild` content validation first)
- `npm test` — Vitest unit tests for `srs.ts` and `session.ts`
- `npm run validate` — validate all JSON in `content/` (Zod schemas, duplicate ids, srsCards references)
- `npm run audio` — generate missing MP3s with msedge-tts (free MS neural voices; incremental, skips existing files)
- `node scripts/csv-to-deck.mjs <file.csv> <topic-id> "<Tiêu đề>"` — convert spreadsheet CSV to a deck JSON

## Architecture

- **Content** is pre-authored JSON in `content/` (decks, dialogues, scenarios, topics), statically imported via `src/lib/content.ts`, validated by Zod schemas in `src/lib/content-schema.ts` (shared by app + validate script). After adding content: run `npm run validate` then `npm run audio`, and register new files in `src/lib/content.ts`.
- **Audio** is pre-generated MP3 in `public/audio/{vocab,dialogues}/` (dialogue lines also have `-slow` variants). `src/lib/speech.ts` plays MP3s and falls back to browser speechSynthesis if a file is missing; also wraps MediaRecorder for shadowing.
- **SRS** is a pure-function SM-2 variant in `src/lib/srs.ts` (4 ratings: Lại/Khó/Tốt/Dễ, learning steps 1m→10m, graduate 1d/easy 4d). Card states persist in IndexedDB via `src/lib/storage.ts` (idb-keyval).
- **Daily plan** is composed by pure `composeSession()` in `src/lib/session.ts` (modes: quick ~20', full ~40', deep ~60'), rendered on the home page. Completion keys (`review`, `listening:<id>`, ...) live in the zustand store `src/stores/progress.ts` (persisted as `tacs-progress` in localStorage) along with streak and settings.
- **AI chat** (`/chat/ai`) calls the Google Gemini free tier directly from the browser (`src/lib/ai.ts`): the user pastes their own API key (from aistudio.google.com/apikey) which is stored in the zustand store, never in the repo. The system prompt makes Gemini roleplay a colleague ("Alex") replying in `REPLY:`/`FEEDBACK:` format — English reply + Vietnamese feedback, parsed in `parseCoachReply()`. Model fallback list lives in `MODELS`. No Anthropic/Claude API is used (no free tier; a static site can't hide a paid key).
- **PWA**: hand-written vanilla service worker `public/sw.js` (NOT Serwist — Next 16 Turbopack builds don't run webpack plugins). Network-first pages, cache-first for `/audio/` and `/_next/static/`. Registered by `src/components/ui/RegisterSW.tsx` in production only. Bump `VERSION` in sw.js when changing caching behavior.
- All pages are static/client-side; there is **no server code**. The app builds with `output: "export"` and deploys to **GitHub Pages** (https://hmt1501.github.io/English-learner/) via `.github/workflows/deploy.yml` on every push to `main`. CI sets `NEXT_PUBLIC_BASE_PATH=/English-learner` (Pages serves at a subpath) — hardcoded absolute URLs must be prefixed with `process.env.NEXT_PUBLIC_BASE_PATH ?? ""` (see `speech.ts`, `layout.tsx`); `sw.js` derives its base from the SW registration scope. The planned Phase-2 AI feedback route would require moving off static export (e.g. to Vercel) since API routes don't work with `output: "export"`.

## Conventions

- ESLint runs the strict React Compiler rules (`react-hooks/purity` etc.): no `Date.now()`/ref access during render — compute in effects or event handlers (wrap handlers using impure calls in `useCallback`). Use `useMounted()` (`src/lib/useMounted.ts`) instead of the setState-in-effect mounted pattern to gate persisted-store reads against hydration mismatch.
- Card/deck/dialogue/scenario `id`s are stable and referenced by audio filenames and `srsCards` — never rename existing ids.
- Vietnamese UI strings are written inline (no i18n layer, app is Vietnamese-only).
