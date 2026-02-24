import { describe, it, expect, beforeEach } from "vitest";
import { PermissionEngine } from "../src/permissions.js";
import type { PermissionRules } from "../src/types.js";

describe("PermissionEngine", () => {
  let engine: PermissionEngine;
  const emptyRules: PermissionRules = { allow: [], deny: [] };

  beforeEach(() => {
    engine = new PermissionEngine(emptyRules);
  });

  describe("read-only tools", () => {
    it("always allows Read, Glob, Grep, WebSearch, WebFetch", () => {
      for (const tool of ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]) {
        expect(engine.check(tool, undefined)).toBe("allow");
      }
    });
  });

  describe("destructive operations", () => {
    it("flags rm -rf as destructive", () => {
      expect(engine.check("Bash", { command: "rm -rf node_modules" })).toBe("ask_destructive");
    });

    it("flags git push --force as destructive", () => {
      expect(engine.check("Bash", { command: "git push --force origin main" })).toBe("ask_destructive");
    });

    it("flags git push -f as destructive", () => {
      expect(engine.check("Bash", { command: "git push -f origin main" })).toBe("ask_destructive");
    });

    it("flags git reset --hard as destructive", () => {
      expect(engine.check("Bash", { command: "git reset --hard HEAD~1" })).toBe("ask_destructive");
    });

    it("flags sudo commands as destructive", () => {
      expect(engine.check("Bash", { command: "sudo rm /etc/hosts" })).toBe("ask_destructive");
    });

    it("flags git clean -f as destructive", () => {
      expect(engine.check("Bash", { command: "git clean -fd" })).toBe("ask_destructive");
    });

    it("does not flag normal git commands as destructive", () => {
      expect(engine.check("Bash", { command: "git status" })).not.toBe("ask_destructive");
    });
  });

  describe("session grants", () => {
    it("allows tool after session grant", () => {
      engine.addSessionGrant("Bash", { command: "npm test" });
      expect(engine.check("Bash", { command: "npm test" })).toBe("allow");
    });

    it("session grant does not override destructive check", () => {
      engine.addSessionGrant("Bash", { command: "rm -rf /" });
      expect(engine.check("Bash", { command: "rm -rf /" })).toBe("ask_destructive");
    });

    it("clears session grants on reset", () => {
      engine.addSessionGrant("Bash", { command: "npm test" });
      engine.resetSessionGrants();
      expect(engine.check("Bash", { command: "npm test" })).toBe("ask");
    });
  });

  describe("settings-based rules", () => {
    it("allows tools matching settings allow patterns", () => {
      const rules: PermissionRules = { allow: ["Bash(git commit:*)"], deny: [] };
      engine = new PermissionEngine(rules);
      expect(engine.check("Bash", { command: "git commit -m 'test'" })).toBe("allow");
    });

    it("denies tools matching settings deny patterns", () => {
      const rules: PermissionRules = { allow: [], deny: ["Bash(npm publish:*)"] };
      engine = new PermissionEngine(rules);
      expect(engine.check("Bash", { command: "npm publish" })).toBe("deny");
    });

    it("deny takes precedence over allow in settings", () => {
      const rules: PermissionRules = {
        allow: ["Bash(npm:*)"],
        deny: ["Bash(npm publish:*)"],
      };
      engine = new PermissionEngine(rules);
      expect(engine.check("Bash", { command: "npm publish" })).toBe("deny");
      expect(engine.check("Bash", { command: "npm test" })).toBe("allow");
    });

    it("settings allow does not override destructive check", () => {
      const rules: PermissionRules = { allow: ["Bash(rm -rf:*)"], deny: [] };
      engine = new PermissionEngine(rules);
      expect(engine.check("Bash", { command: "rm -rf /" })).toBe("ask_destructive");
    });
  });

  describe("fallthrough", () => {
    it("returns ask for unknown tools", () => {
      expect(engine.check("Bash", { command: "some-random-thing" })).toBe("ask");
    });

    it("returns ask for non-read-only tools without rules", () => {
      expect(engine.check("Edit", { file_path: "/tmp/test" })).toBe("ask");
      expect(engine.check("Write", { file_path: "/tmp/test" })).toBe("ask");
    });
  });
});
