// Kiểm tra toàn bộ nội dung trong /content: đúng schema Zod, không trùng id,
// tham chiếu srsCards hợp lệ, đáp án câu hỏi trong phạm vi options.
// Chạy ở prebuild: node scripts/validate-content.mjs
// (Node >= 23 chạy được TypeScript trực tiếp nên import schema từ src)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  TopicSchema,
  VocabDeckSchema,
  DialogueSchema,
  ChatScenarioSchema,
} from "../src/lib/content-schema.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const errors = [];

function loadDir(dir) {
  const full = path.join(ROOT, "content", dir);
  return readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: `${dir}/${f}`, data: JSON.parse(readFileSync(path.join(full, f), "utf8")) }));
}

function check(schema, file, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${file}: ${issue.path.join(".")} — ${issue.message}`);
    }
    return null;
  }
  return result.data;
}

// Topics
const topicsRaw = JSON.parse(readFileSync(path.join(ROOT, "content/topics.json"), "utf8"));
const topics = topicsRaw.map((t) => check(TopicSchema, "topics.json", t)).filter(Boolean);
const topicIds = new Set(topics.map((t) => t.id));

// Decks
const allCardIds = new Set();
for (const { file, data } of loadDir("decks")) {
  const deck = check(VocabDeckSchema, file, data);
  if (!deck) continue;
  if (!topicIds.has(deck.topic)) errors.push(`${file}: topic "${deck.topic}" không tồn tại`);
  for (const card of deck.cards) {
    if (allCardIds.has(card.id)) errors.push(`${file}: trùng card id "${card.id}"`);
    allCardIds.add(card.id);
    if (card.cloze && !card.cloze.includes("___")) {
      errors.push(`${file}: thẻ "${card.id}" có cloze nhưng thiếu "___"`);
    }
  }
}

// Dialogues
const dialogueIds = new Set();
for (const { file, data } of loadDir("dialogues")) {
  const d = check(DialogueSchema, file, data);
  if (!d) continue;
  if (dialogueIds.has(d.id)) errors.push(`${file}: trùng dialogue id "${d.id}"`);
  dialogueIds.add(d.id);
  if (!topicIds.has(d.topic)) errors.push(`${file}: topic "${d.topic}" không tồn tại`);
  for (const [i, q] of d.questions.entries()) {
    if (q.answer >= q.options.length) {
      errors.push(`${file}: câu hỏi #${i + 1} có answer=${q.answer} vượt quá số options`);
    }
  }
}

// Scenarios
const scenarioIds = new Set();
for (const { file, data } of loadDir("scenarios")) {
  const s = check(ChatScenarioSchema, file, data);
  if (!s) continue;
  if (scenarioIds.has(s.id)) errors.push(`${file}: trùng scenario id "${s.id}"`);
  scenarioIds.add(s.id);
  if (!topicIds.has(s.topic)) errors.push(`${file}: topic "${s.topic}" không tồn tại`);
  for (const cardId of s.srsCards) {
    if (!allCardIds.has(cardId)) errors.push(`${file}: srsCards tham chiếu thẻ không tồn tại "${cardId}"`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} lỗi nội dung:`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `✓ Nội dung hợp lệ: ${topics.length} chủ đề, ${allCardIds.size} thẻ, ${dialogueIds.size} hội thoại, ${scenarioIds.size} tình huống.`
);
