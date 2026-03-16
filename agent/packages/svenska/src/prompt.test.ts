import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildSummaryPrompt } from "./prompt.js";

describe("buildSystemPrompt", () => {
  it("includes scenario prompt and correction instructions", () => {
    const prompt = buildSystemPrompt("Du är receptionist på en fastighetsförvaltning...");
    expect(prompt).toContain("receptionist");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("corrections");
    expect(prompt).toContain("reply");
    expect(prompt).toContain("done");
  });
});

describe("buildSummaryPrompt", () => {
  it("includes conversation history reference", () => {
    const prompt = buildSummaryPrompt();
    expect(prompt).toContain("summary");
    expect(prompt).toContain("patterns");
  });
});
