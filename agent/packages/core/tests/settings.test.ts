import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadSettings, matchesPermissionPattern } from "../src/settings.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

describe("matchesPermissionPattern", () => {
  it("matches exact tool name", () => {
    expect(matchesPermissionPattern("Read", "Read", undefined)).toBe(true);
    expect(matchesPermissionPattern("Read", "Write", undefined)).toBe(false);
  });

  it("matches Bash command prefix pattern", () => {
    const input = { command: "git commit -m 'test'" };
    expect(matchesPermissionPattern("Bash(git commit:*)", "Bash", input)).toBe(true);
    expect(matchesPermissionPattern("Bash(git push:*)", "Bash", input)).toBe(false);
  });

  it("matches Bash pattern only for Bash tool", () => {
    expect(matchesPermissionPattern("Bash(git commit:*)", "Read", undefined)).toBe(false);
  });

  it("matches wildcard tool patterns", () => {
    expect(matchesPermissionPattern("mcp__chrome__*", "mcp__chrome__click", undefined)).toBe(true);
    expect(matchesPermissionPattern("mcp__chrome__*", "mcp__other__click", undefined)).toBe(false);
  });

  it("matches exact MCP tool names", () => {
    expect(matchesPermissionPattern(
      "mcp__context7__resolve-library-id",
      "mcp__context7__resolve-library-id",
      undefined
    )).toBe(true);
  });
});

describe("loadSettings", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hamid-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns empty rules when no settings files exist", () => {
    const rules = loadSettings(tmpDir, tmpDir);
    expect(rules.allow).toEqual([]);
    expect(rules.deny).toEqual([]);
  });

  it("loads allow rules from settings.json", () => {
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ permissions: { allow: ["Read", "WebFetch"] } })
    );
    const rules = loadSettings(tmpDir, "/nonexistent");
    expect(rules.allow).toContain("Read");
    expect(rules.allow).toContain("WebFetch");
  });

  it("merges project and global settings", () => {
    // Project settings
    const projClaude = path.join(tmpDir, "project", ".claude");
    fs.mkdirSync(projClaude, { recursive: true });
    fs.writeFileSync(
      path.join(projClaude, "settings.json"),
      JSON.stringify({ permissions: { allow: ["Bash(npm test:*)"] } })
    );
    // Global settings
    const globalClaude = path.join(tmpDir, "global", ".claude");
    fs.mkdirSync(globalClaude, { recursive: true });
    fs.writeFileSync(
      path.join(globalClaude, "settings.json"),
      JSON.stringify({ permissions: { allow: ["WebSearch"] } })
    );
    const rules = loadSettings(
      path.join(tmpDir, "project"),
      path.join(tmpDir, "global")
    );
    expect(rules.allow).toContain("Bash(npm test:*)");
    expect(rules.allow).toContain("WebSearch");
  });

  it("loads settings.local.json and merges with settings.json", () => {
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ permissions: { allow: ["Read"] } })
    );
    fs.writeFileSync(
      path.join(claudeDir, "settings.local.json"),
      JSON.stringify({ permissions: { allow: ["Bash(pytest:*)"] } })
    );
    const rules = loadSettings(tmpDir, "/nonexistent");
    expect(rules.allow).toContain("Read");
    expect(rules.allow).toContain("Bash(pytest:*)");
  });
});
