import { describe, it, expect } from "vitest";
import { markdownToTelegram } from "../src/format.js";

describe("markdownToTelegram", () => {
  it("escapes special characters in plain text", () => {
    const result = markdownToTelegram("Hello world. This is a test!");
    expect(result).toBe("Hello world\\. This is a test\\!");
  });

  it("converts headers to bold", () => {
    const result = markdownToTelegram("## Hello World");
    expect(result).toBe("*Hello World*");
  });

  it("preserves code blocks without escaping", () => {
    const result = markdownToTelegram("```js\nconst x = 1;\n```");
    expect(result).toBe("```js\nconst x = 1;\n```");
  });

  it("preserves inline code", () => {
    const result = markdownToTelegram("Use `npm test` to run");
    expect(result).toContain("`npm test`");
  });

  it("converts bold markers", () => {
    const result = markdownToTelegram("This is **bold** text");
    expect(result).toContain("*bold*");
  });

  it("handles empty lines", () => {
    const result = markdownToTelegram("Line one\n\nLine two");
    expect(result).toBe("Line one\n\nLine two");
  });

  it("handles links", () => {
    const result = markdownToTelegram("Visit [Google](https://google.com)");
    expect(result).toContain("[Google](https://google.com)");
  });
});
