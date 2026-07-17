// Âm thanh & giọng nói: phát MP3 tạo sẵn, fallback sang speechSynthesis,
// và wrapper ghi âm MediaRecorder. Chỉ dùng ở client.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let currentAudio: HTMLAudioElement | null = null;

/** Phát 1 file audio; trả Promise resolve khi phát xong, reject nếu file lỗi/thiếu */
export function playAudio(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const audio = new Audio(src);
    currentAudio = audio;
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error(`Không phát được ${src}`));
    audio.play().catch(reject);
  });
}

export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

/** Đọc văn bản bằng speechSynthesis của trình duyệt (fallback khi thiếu MP3) */
export function speakFallback(text: string, rate = 1): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === "undefined") return resolve();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    const voices = speechSynthesis.getVoices();
    const enVoice = voices.find((v) => v.lang.startsWith("en") && v.localService) ?? voices.find((v) => v.lang.startsWith("en"));
    if (enVoice) utterance.voice = enVoice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });
}

/** Phát MP3 từ vựng, tự fallback sang TTS trình duyệt nếu file thiếu */
export async function playVocab(audioId: string, text: string): Promise<void> {
  try {
    await playAudio(`${BASE}/audio/vocab/${audioId}.mp3`);
  } catch {
    await speakFallback(text);
  }
}

export async function playDialogueLine(audioId: string, text: string, slow = false): Promise<void> {
  try {
    await playAudio(`${BASE}/audio/dialogues/${audioId}${slow ? "-slow" : ""}.mp3`);
  } catch {
    await speakFallback(text, slow ? 0.7 : 1);
  }
}

// ---- Ghi âm (shadowing) ----

export type Recorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
};

export function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = ["audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  const cleanup = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          cleanup();
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // đã dừng rồi thì thôi
      }
      cleanup();
    },
  };
}
