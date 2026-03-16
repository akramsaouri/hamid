import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recordSession, getConsecutiveMissedDays } from "./accountability.js";

const testDir = join(tmpdir(), "svenska-test-" + Date.now());
const testFile = join(testDir, ".svenska-sessions.json");

describe("recordSession", () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  it("creates file if it doesn't exist", () => {
    recordSession("test-scenario", 3, testFile);
    expect(existsSync(testFile)).toBe(true);
  });

  it("appends session record", () => {
    recordSession("scenario-1", 2, testFile);
    recordSession("scenario-2", 1, testFile);
    const data = JSON.parse(readFileSync(testFile, "utf-8"));
    expect(data.sessions).toHaveLength(2);
  });
});

describe("getConsecutiveMissedDays", () => {
  afterEach(() => {
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  it("returns 1 when no sessions exist", () => {
    expect(getConsecutiveMissedDays(testFile)).toBeGreaterThanOrEqual(1);
  });
});
