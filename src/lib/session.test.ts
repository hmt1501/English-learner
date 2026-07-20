import { describe, it, expect } from "vitest";
import { composeSession, pickLeastRecent, pickTodayTopic, type ComposeInput } from "./session";

const DAY = 86_400_000;

const base: ComposeInput = {
  mode: "full",
  topicIds: ["t1", "t2", "t3"],
  topicLastStudied: {},
  dialogueIds: ["d1", "d2", "d3"],
  scenarioIds: ["s1", "s2"],
  lastDone: {},
  dayIndex: 100,
};

describe("pickTodayTopic", () => {
  it("ưu tiên chủ đề chưa từng học", () => {
    expect(pickTodayTopic(["a", "b"], { a: 5 * DAY }, 100)).toBe("b");
  });
  it("bỏ qua chủ đề đã học hôm nay", () => {
    // a học hôm nay (dayIndex 100), b học lâu rồi → chọn b
    expect(pickTodayTopic(["a", "b"], { a: 100 * DAY + 3600_000, b: 50 * DAY }, 100)).toBe("b");
  });
  it("nếu mọi chủ đề đều học hôm nay vẫn trả về một cái", () => {
    const r = pickTodayTopic(["a", "b"], { a: 100 * DAY, b: 100 * DAY }, 100);
    expect(["a", "b"]).toContain(r);
  });
});

describe("pickLeastRecent", () => {
  it("ưu tiên bài chưa từng làm", () => {
    expect(pickLeastRecent(["a", "b"], { a: 100 })).toBe("b");
  });
  it("tôn trọng danh sách loại trừ", () => {
    expect(pickLeastRecent(["a", "b"], {}, ["a"])).toBe("b");
  });
});

describe("composeSession", () => {
  it("quick: học từ vựng chủ đề + 1 kỹ năng", () => {
    const items = composeSession({ ...base, mode: "quick", dayIndex: 100 });
    expect(items[0]).toEqual({ type: "vocab", topicId: "t1" });
    expect(items[1].type).toBe("listening"); // dayIndex chẵn
    expect(items).toHaveLength(2);
  });

  it("quick: ngày lẻ xoay sang shadowing", () => {
    const items = composeSession({ ...base, mode: "quick", dayIndex: 101 });
    expect(items[1].type).toBe("shadowing");
  });

  it("full: có thêm tình huống chat", () => {
    const items = composeSession({ ...base, dayIndex: 100 });
    expect(items.map((i) => i.type)).toEqual(["vocab", "listening", "chat"]);
  });

  it("deep: nghe và nói theo là 2 bài khác nhau", () => {
    const items = composeSession({ ...base, mode: "deep", dayIndex: 100 });
    const listening = items.find((i) => i.type === "listening");
    const shadowing = items.find((i) => i.type === "shadowing");
    if (listening && shadowing && "id" in listening && "id" in shadowing) {
      expect(listening.id).not.toBe(shadowing.id);
    }
  });

  it("luôn có mục học từ vựng đầu tiên", () => {
    const items = composeSession(base);
    expect(items[0].type).toBe("vocab");
  });

  it("xoay vòng chủ đề: chọn chủ đề chưa học", () => {
    const items = composeSession({ ...base, topicLastStudied: { t1: 100, t2: 200 }, dayIndex: 100 });
    const vocab = items.find((i) => i.type === "vocab");
    expect(vocab && "topicId" in vocab && vocab.topicId).toBe("t3");
  });
});
