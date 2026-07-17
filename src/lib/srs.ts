// Thuật toán lặp lại ngắt quãng (SM-2 rút gọn kiểu Anki).
// Toàn bộ là pure function — không đụng storage, dễ unit test.

export type Rating = "again" | "hard" | "good" | "easy";

export type CardState = {
  state: "new" | "learning" | "review" | "relearning";
  /** Bước hiện tại trong learning/relearning */
  stepIndex: number;
  /** Khoảng cách ôn tập (ngày) khi ở trạng thái review */
  interval: number;
  ease: number;
  /** Thời điểm đến hạn (epoch ms) */
  due: number;
  reps: number;
  lapses: number;
};

const MIN = 60_000;
const DAY = 24 * 60 * 60 * 1000;

/** Các bước học (phút) trước khi thẻ "tốt nghiệp" thành review */
const LEARNING_STEPS_MIN = [1, 10];
const RELEARNING_STEP_MIN = 10;
const GRADUATE_INTERVAL = 1; // ngày
const EASY_INTERVAL = 4; // ngày
const MIN_EASE = 1.3;
const MAX_EASE = 2.8;
const START_EASE = 2.5;

export function newCardState(now: number): CardState {
  return { state: "new", stepIndex: 0, interval: 0, ease: START_EASE, due: now, reps: 0, lapses: 0 };
}

export function isDue(card: CardState, now: number): boolean {
  return card.due <= now;
}

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, ease));
}

export function schedule(card: CardState, rating: Rating, now: number): CardState {
  const next: CardState = { ...card, reps: card.reps + 1 };

  if (card.state === "new" || card.state === "learning") {
    if (rating === "again") {
      next.state = "learning";
      next.stepIndex = 0;
      next.due = now + LEARNING_STEPS_MIN[0] * MIN;
    } else if (rating === "hard") {
      next.state = "learning";
      next.due = now + 6 * MIN;
    } else if (rating === "good") {
      const nextStep = card.state === "new" ? 1 : card.stepIndex + 1;
      if (nextStep >= LEARNING_STEPS_MIN.length) {
        next.state = "review";
        next.interval = GRADUATE_INTERVAL;
        next.due = now + GRADUATE_INTERVAL * DAY;
      } else {
        next.state = "learning";
        next.stepIndex = nextStep;
        next.due = now + LEARNING_STEPS_MIN[nextStep] * MIN;
      }
    } else {
      next.state = "review";
      next.interval = EASY_INTERVAL;
      next.due = now + EASY_INTERVAL * DAY;
    }
    return next;
  }

  if (card.state === "relearning") {
    if (rating === "again") {
      next.due = now + RELEARNING_STEP_MIN * MIN;
    } else {
      next.state = "review";
      next.due = now + card.interval * DAY;
    }
    return next;
  }

  // state === "review"
  if (rating === "again") {
    next.state = "relearning";
    next.stepIndex = 0;
    next.lapses = card.lapses + 1;
    next.ease = clampEase(card.ease - 0.2);
    next.interval = Math.max(1, Math.round(card.interval * 0.3));
    next.due = now + RELEARNING_STEP_MIN * MIN;
  } else if (rating === "hard") {
    next.ease = clampEase(card.ease - 0.15);
    next.interval = Math.max(card.interval + 1, Math.round(card.interval * 1.2));
    next.due = now + next.interval * DAY;
  } else if (rating === "good") {
    next.interval = Math.max(card.interval + 1, Math.round(card.interval * card.ease));
    next.due = now + next.interval * DAY;
  } else {
    next.ease = clampEase(card.ease + 0.15);
    next.interval = Math.max(card.interval + 2, Math.round(card.interval * card.ease * 1.3));
    next.due = now + next.interval * DAY;
  }
  return next;
}

/** Nhãn thời gian dự kiến hiện trên nút đánh giá, ví dụ "10 phút" / "3 ngày" */
export function previewInterval(card: CardState, rating: Rating, now: number): string {
  const next = schedule(card, rating, now);
  const diff = next.due - now;
  if (diff < 60 * MIN) return `${Math.round(diff / MIN)} phút`;
  if (diff < DAY) return `${Math.round(diff / (60 * MIN))} giờ`;
  const days = Math.round(diff / DAY);
  if (days < 30) return `${days} ngày`;
  return `${(days / 30).toFixed(1)} tháng`;
}
