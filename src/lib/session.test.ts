import { describe, it, expect } from "vitest";
import { composeSession, pickLeastRecent, type ComposeInput } from "./session";

const base: ComposeInput = {
  mode: "full",
  dueCount: 12,
  newAvailable: 10,
  dialogueIds: ["d1", "d2", "d3"],
  scenarioIds: ["s1", "s2"],
  lastDone: {},
  dayIndex: 0,
};

describe("pickLeastRecent", () => {
  it("ưu tiên bài chưa từng làm", () => {
    expect(pickLeastRecent(["a", "b"], { a: 100 })).toBe("b");
  });
  it("chọn bài làm lâu nhất khi tất cả đã làm", () => {
    expect(pickLeastRecent(["a", "b"], { a: 100, b: 50 })).toBe("b");
  });
  it("tôn trọng danh sách loại trừ", () => {
    expect(pickLeastRecent(["a", "b"], {}, ["a"])).toBe("b");
  });
});

describe("composeSession", () => {
  it("quick: ôn tập + 1 kỹ năng + ít từ mới", () => {
    const items = composeSession({ ...base, mode: "quick" });
    expect(items[0]).toEqual({ type: "review", dueCount: 12 });
    expect(items[1].type).toBe("listening"); // dayIndex 0 chẵn
    expect(items[2]).toEqual({ type: "newCards", count: 5 });
  });

  it("quick: ngày lẻ xoay sang shadowing", () => {
    const items = composeSession({ ...base, mode: "quick", dayIndex: 1 });
    expect(items[1].type).toBe("shadowing");
  });

  it("full: có thêm tình huống chat và đủ từ mới", () => {
    const items = composeSession(base);
    const types = items.map((i) => i.type);
    expect(types).toEqual(["review", "listening", "chat", "newCards"]);
    expect(items.at(-1)).toEqual({ type: "newCards", count: 10 });
  });

  it("deep: nghe và nói theo là 2 bài khác nhau", () => {
    const items = composeSession({ ...base, mode: "deep" });
    const listening = items.find((i) => i.type === "listening");
    const shadowing = items.find((i) => i.type === "shadowing");
    expect(listening && "id" in listening && listening.id).toBeTruthy();
    expect(shadowing && "id" in shadowing && shadowing.id).toBeTruthy();
    if (listening && shadowing && "id" in listening && "id" in shadowing) {
      expect(listening.id).not.toBe(shadowing.id);
    }
  });

  it("không có review khi không có thẻ đến hạn", () => {
    const items = composeSession({ ...base, dueCount: 0 });
    expect(items.find((i) => i.type === "review")).toBeUndefined();
  });

  it("không có newCards khi đã đạt cap trong ngày", () => {
    const items = composeSession({ ...base, newAvailable: 0 });
    expect(items.find((i) => i.type === "newCards")).toBeUndefined();
  });

  it("xoay vòng: chọn hội thoại chưa làm trước", () => {
    const items = composeSession({ ...base, lastDone: { d1: 100, d2: 200 } });
    const listening = items.find((i) => i.type === "listening");
    expect(listening && "id" in listening && listening.id).toBe("d3");
  });
});
