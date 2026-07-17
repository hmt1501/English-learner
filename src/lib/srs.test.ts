import { describe, it, expect } from "vitest";
import { newCardState, schedule, isDue, previewInterval, type CardState } from "./srs";

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const DAY = 24 * 60 * 60 * 1000;

describe("srs", () => {
  it("thẻ mới đến hạn ngay lập tức", () => {
    const card = newCardState(NOW);
    expect(isDue(card, NOW)).toBe(true);
    expect(card.state).toBe("new");
  });

  it("new + good → bước học 10 phút", () => {
    const next = schedule(newCardState(NOW), "good", NOW);
    expect(next.state).toBe("learning");
    expect(next.stepIndex).toBe(1);
    expect(next.due).toBe(NOW + 10 * MIN);
  });

  it("learning bước cuối + good → tốt nghiệp 1 ngày", () => {
    const learning = schedule(newCardState(NOW), "good", NOW);
    const next = schedule(learning, "good", NOW);
    expect(next.state).toBe("review");
    expect(next.interval).toBe(1);
    expect(next.due).toBe(NOW + DAY);
  });

  it("new + easy → tốt nghiệp thẳng 4 ngày", () => {
    const next = schedule(newCardState(NOW), "easy", NOW);
    expect(next.state).toBe("review");
    expect(next.interval).toBe(4);
  });

  it("new + again → quay lại bước 1 phút", () => {
    const next = schedule(newCardState(NOW), "again", NOW);
    expect(next.state).toBe("learning");
    expect(next.due).toBe(NOW + 1 * MIN);
  });

  it("review + good → interval nhân với ease", () => {
    const card: CardState = { state: "review", stepIndex: 0, interval: 10, ease: 2.5, due: NOW, reps: 5, lapses: 0 };
    const next = schedule(card, "good", NOW);
    expect(next.interval).toBe(25);
    expect(next.due).toBe(NOW + 25 * DAY);
  });

  it("review + again → lapse: relearning, ease giảm, interval co lại", () => {
    const card: CardState = { state: "review", stepIndex: 0, interval: 20, ease: 2.5, due: NOW, reps: 5, lapses: 0 };
    const next = schedule(card, "again", NOW);
    expect(next.state).toBe("relearning");
    expect(next.lapses).toBe(1);
    expect(next.ease).toBe(2.3);
    expect(next.interval).toBe(6); // 20 * 0.3
    expect(next.due).toBe(NOW + 10 * MIN);
  });

  it("relearning + good → trở lại review với interval đã co", () => {
    const card: CardState = { state: "relearning", stepIndex: 0, interval: 6, ease: 2.3, due: NOW, reps: 6, lapses: 1 };
    const next = schedule(card, "good", NOW);
    expect(next.state).toBe("review");
    expect(next.due).toBe(NOW + 6 * DAY);
  });

  it("review + hard → interval tăng ít nhất 1 ngày, ease giảm", () => {
    const card: CardState = { state: "review", stepIndex: 0, interval: 2, ease: 2.5, due: NOW, reps: 3, lapses: 0 };
    const next = schedule(card, "hard", NOW);
    expect(next.interval).toBe(3); // max(2+1, round(2*1.2)=2) = 3
    expect(next.ease).toBe(2.35);
  });

  it("ease không xuống dưới 1.3", () => {
    let card: CardState = { state: "review", stepIndex: 0, interval: 5, ease: 1.35, due: NOW, reps: 3, lapses: 0 };
    card = schedule(card, "again", NOW);
    expect(card.ease).toBe(1.3);
  });

  it("interval luôn tăng đơn điệu với good liên tiếp", () => {
    let card: CardState = { state: "review", stepIndex: 0, interval: 1, ease: 2.5, due: NOW, reps: 1, lapses: 0 };
    let prev = card.interval;
    for (let i = 0; i < 10; i++) {
      card = schedule(card, "good", NOW);
      expect(card.interval).toBeGreaterThan(prev);
      prev = card.interval;
    }
  });

  it("previewInterval trả nhãn tiếng Việt", () => {
    const card = newCardState(NOW);
    expect(previewInterval(card, "again", NOW)).toBe("1 phút");
    expect(previewInterval(card, "easy", NOW)).toBe("4 ngày");
  });
});
