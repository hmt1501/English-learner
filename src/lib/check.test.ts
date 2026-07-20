import { describe, it, expect } from "vitest";
import { checkMeaning, checkTranslation, checkTranslationVi, normalize } from "./check";

describe("normalize", () => {
  it("bỏ dấu câu và gộp khoảng trắng", () => {
    expect(normalize("  Tôi sẽ trả lời!  ")).toBe("tôi sẽ trả lời");
  });
});

describe("checkMeaning", () => {
  it("khớp chính xác", () => {
    expect(checkMeaning("đã ghi nhận, cảm ơn", "Đã ghi nhận, cảm ơn!")).toBe("correct");
  });
  it("bỏ dấu vẫn đúng", () => {
    expect(checkMeaning("da ghi nhan cam on", "Đã ghi nhận, cảm ơn!")).toBe("correct");
  });
  it("người học viết một phần cốt lõi vẫn chấp nhận", () => {
    expect(checkMeaning("trả lời sớm", "Tôi sẽ trả lời bạn sớm.")).toBe("correct");
  });
  it("thiếu nhiều từ cốt lõi → gần đúng hoặc sai", () => {
    expect(checkMeaning("xin chào", "Tôi sẽ trả lời bạn sớm.")).toBe("wrong");
  });
  it("rỗng → sai", () => {
    expect(checkMeaning("", "bất kỳ")).toBe("wrong");
  });
});

describe("checkTranslationVi", () => {
  it("khớp chính xác không phân biệt dấu câu", () => {
    expect(checkTranslationVi("Tôi sẽ trả lời bạn sớm", "Tôi sẽ trả lời bạn sớm.")).toBe("correct");
  });
  it("bỏ dấu vẫn đúng", () => {
    expect(checkTranslationVi("toi se tra loi ban som", "Tôi sẽ trả lời bạn sớm.")).toBe("correct");
  });
  it("đủ ý cốt lõi dù thiếu từ phụ", () => {
    expect(checkTranslationVi("sẽ trả lời bạn sớm", "Tôi sẽ trả lời bạn sớm.")).toBe("correct");
  });
  it("chỉ được một phần ý → gần đúng", () => {
    expect(checkTranslationVi("tôi sẽ trả lời sớm", "Tôi sẽ trả lời bạn sớm nhất có thể.")).toBe("close");
  });
  it("sai hoàn toàn → wrong", () => {
    expect(checkTranslationVi("xin chào buổi sáng", "Hệ thống đang gặp sự cố.")).toBe("wrong");
  });
  it("rỗng → sai", () => {
    expect(checkTranslationVi("", "bất kỳ")).toBe("wrong");
  });
});

describe("checkTranslation", () => {
  it("khớp chính xác không phân biệt hoa thường/dấu câu", () => {
    expect(checkTranslation("I'll get back to you shortly", "I'll get back to you shortly.")).toBe("correct");
  });
  it("đủ từ nội dung dù khác từ phụ", () => {
    expect(checkTranslation("get back to you shortly", "I will get back to you shortly")).toBe("correct");
  });
  it("một nửa từ nội dung → gần đúng", () => {
    expect(checkTranslation("sorry for delay report", "sorry for the delay the report is attached")).toBe("close");
  });
  it("sai hoàn toàn → wrong", () => {
    expect(checkTranslation("hello there friend", "the system is down now")).toBe("wrong");
  });
});
