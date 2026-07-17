// Tạo file MP3 cho thẻ từ vựng và hội thoại bằng giọng neural miễn phí của Microsoft Edge.
// Chạy: node scripts/generate-audio.mjs   (incremental — bỏ qua file đã tồn tại)
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { readdirSync, readFileSync, existsSync, mkdirSync, createWriteStream, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const VOCAB_DIR = path.join(ROOT, "public/audio/vocab");
const DIALOGUE_DIR = path.join(ROOT, "public/audio/dialogues");
mkdirSync(VOCAB_DIR, { recursive: true });
mkdirSync(DIALOGUE_DIR, { recursive: true });

const VOICE_FEMALE = "en-US-JennyNeural";
const VOICE_MALE = "en-US-ChristopherNeural";
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
const SLOW_RATE = 0.75;

function readJsonDir(dir) {
  const full = path.join(ROOT, "content", dir);
  return readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(full, f), "utf8")));
}

/** Danh sách việc cần làm: { file, text, voice, rate } */
const jobs = [];

for (const deck of readJsonDir("decks")) {
  for (const card of deck.cards) {
    jobs.push({
      file: path.join(VOCAB_DIR, `${card.audio}.mp3`),
      text: card.chunk,
      voice: VOICE_FEMALE,
    });
  }
}

for (const dialogue of readJsonDir("dialogues")) {
  for (const line of dialogue.lines) {
    const voice = line.speaker === "A" ? VOICE_MALE : VOICE_FEMALE;
    jobs.push({ file: path.join(DIALOGUE_DIR, `${line.audio}.mp3`), text: line.text, voice });
    jobs.push({
      file: path.join(DIALOGUE_DIR, `${line.audio}-slow.mp3`),
      text: line.text,
      voice,
      rate: SLOW_RATE,
    });
  }
}

const pending = jobs.filter((j) => !existsSync(j.file));
console.log(`Tổng ${jobs.length} file, cần tạo ${pending.length} (bỏ qua ${jobs.length - pending.length} đã có).`);

// Giữ 1 kết nối TTS cho mỗi giọng để tránh handshake lặp lại
const ttsByVoice = new Map();
async function getTts(voice) {
  if (!ttsByVoice.has(voice)) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, FORMAT);
    ttsByVoice.set(voice, tts);
  }
  return ttsByVoice.get(voice);
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function synthesize(job, attempt = 1) {
  const tts = await getTts(job.voice);
  const options = job.rate ? { rate: job.rate } : undefined;
  const { audioStream } = await tts.toStream(escapeXml(job.text), options);
  await new Promise((resolve, reject) => {
    const out = createWriteStream(job.file);
    audioStream.pipe(out);
    audioStream.on("error", reject);
    out.on("finish", resolve);
    out.on("error", reject);
  }).catch(async (err) => {
    if (existsSync(job.file)) unlinkSync(job.file);
    if (attempt < 3) {
      ttsByVoice.delete(job.voice); // kết nối có thể đã chết — tạo lại
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return synthesize(job, attempt + 1);
    }
    throw err;
  });
}

let done = 0;
let failed = 0;
for (const job of pending) {
  try {
    await synthesize(job);
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${pending.length}...`);
  } catch (err) {
    failed++;
    console.error(`LỖI ${path.basename(job.file)}: ${err.message}`);
  }
}

console.log(`Xong: ${done} file tạo mới, ${failed} lỗi.`);
process.exit(failed > 0 ? 1 : 0);
