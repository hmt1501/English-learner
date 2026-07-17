// Chuyển file CSV soạn trong Excel/Google Sheets thành deck JSON.
// Cột CSV (có header): id,chunk,meaningVi,example,exampleVi,cue,cloze
// Chạy: node scripts/csv-to-deck.mjs <file.csv> <topic-id> "<Tiêu đề tiếng Việt>"
// Ví dụ: node scripts/csv-to-deck.mjs new-cards.csv meetings "Họp hành"
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [csvPath, topicId, titleVi] = process.argv.slice(2);
if (!csvPath || !topicId || !titleVi) {
  console.error('Cách dùng: node scripts/csv-to-deck.mjs <file.csv> <topic-id> "<Tiêu đề>"');
  process.exit(1);
}

/** Parse CSV đơn giản có hỗ trợ trường trong dấu nháy kép */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f !== "")) rows.push(row); }
  return rows;
}

const text = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const [header, ...rows] = parseCsv(text);
const required = ["id", "chunk", "meaningVi", "example", "exampleVi", "cue"];
for (const col of required) {
  if (!header.includes(col)) {
    console.error(`Thiếu cột "${col}" trong CSV. Header cần: id,chunk,meaningVi,example,exampleVi,cue,cloze`);
    process.exit(1);
  }
}

const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
const cards = rows.map((r) => {
  const card = {
    id: r[idx.id].trim(),
    chunk: r[idx.chunk].trim(),
    meaningVi: r[idx.meaningVi].trim(),
    example: r[idx.example].trim(),
    exampleVi: r[idx.exampleVi].trim(),
    cue: r[idx.cue].trim(),
    audio: r[idx.id].trim(),
  };
  const cloze = idx.cloze !== undefined ? r[idx.cloze]?.trim() : "";
  if (cloze) card.cloze = cloze;
  return card;
});

const deck = { id: topicId, topic: topicId, titleVi, cards };
const outPath = path.resolve(import.meta.dirname, "..", "content/decks", `${topicId}.json`);
writeFileSync(outPath, JSON.stringify(deck, null, 2) + "\n", "utf8");
console.log(`✓ Đã ghi ${cards.length} thẻ vào ${outPath}`);
console.log("  Tiếp theo: node scripts/validate-content.mjs && node scripts/generate-audio.mjs");
