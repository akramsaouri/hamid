import { describe, it, expect } from "vitest";
import { matchRule, evaluateRules } from "../src/rules.js";
import { GmailMessage, EmailRule, EmailAccount } from "../src/types.js";

function makeMessage(overrides: Partial<GmailMessage> = {}): GmailMessage {
  return {
    id: "msg-1",
    threadId: "thread-1",
    from: "sender@example.com",
    to: "me@example.com",
    subject: "Test email",
    snippet: "This is a test",
    body: "This is a test email body",
    date: new Date("2026-02-25"),
    labels: ["INBOX", "UNREAD"],
    ...overrides,
  };
}

describe("matchRule", () => {
  it("matches from pattern with wildcard", () => {
    const rule: EmailRule = { match: { from: "*@marketing.*" }, action: "trash" };
    const msg = makeMessage({ from: "promo@marketing.company.com" });
    expect(matchRule(msg, rule)).toBe(true);
  });

  it("does not match when from differs", () => {
    const rule: EmailRule = { match: { from: "*@marketing.*" }, action: "trash" };
    const msg = makeMessage({ from: "ceo@company.com" });
    expect(matchRule(msg, rule)).toBe(false);
  });

  it("matches subject pattern", () => {
    const rule: EmailRule = {
      match: { subject: "*invoice*" },
      action: "create_todo",
    };
    const msg = makeMessage({ subject: "Your invoice #1234 is ready" });
    expect(matchRule(msg, rule)).toBe(true);
  });

  it("matches combined from + subject", () => {
    const rule: EmailRule = {
      match: { from: "*@jira.*", subject: "*assigned to you*" },
      action: "create_todo",
    };
    const msg = makeMessage({
      from: "noreply@jira.atlassian.com",
      subject: "[PROJ-123] Task assigned to you",
    });
    expect(matchRule(msg, rule)).toBe(true);
  });

  it("fails combined match when one field misses", () => {
    const rule: EmailRule = {
      match: { from: "*@jira.*", subject: "*assigned to you*" },
      action: "create_todo",
    };
    const msg = makeMessage({
      from: "noreply@jira.atlassian.com",
      subject: "Sprint report",
    });
    expect(matchRule(msg, rule)).toBe(false);
  });

  it("matches case-insensitively", () => {
    const rule: EmailRule = { match: { from: "*@MARKETING.*" }, action: "trash" };
    const msg = makeMessage({ from: "promo@marketing.co" });
    expect(matchRule(msg, rule)).toBe(true);
  });
});

describe("evaluateRules", () => {
  const account: EmailAccount = {
    address: "me@example.com",
    schedule: "0 */1 * * *",
    allowDelete: true,
    rules: [
      { match: { from: "*@marketing.*" }, action: "trash" },
      { match: { from: "*@bank.*" }, action: "create_todo", priority: "high" },
      { match: { subject: "*unsubscribe*" }, action: "trash" },
    ],
  };

  it("returns first matching rule decision", () => {
    const msg = makeMessage({ from: "news@marketing.co" });
    const result = evaluateRules(msg, account);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("trash");
    expect(result!.source).toBe("rule");
  });

  it("respects rule priority", () => {
    const msg = makeMessage({ from: "alerts@bank.com" });
    const result = evaluateRules(msg, account);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("create_todo");
    expect(result!.priority).toBe("high");
  });

  it("returns null when no rules match", () => {
    const msg = makeMessage({ from: "friend@personal.com" });
    const result = evaluateRules(msg, account);
    expect(result).toBeNull();
  });

  it("blocks trash action when allowDelete is false", () => {
    const noDeleteAccount: EmailAccount = { ...account, allowDelete: false };
    const msg = makeMessage({ from: "news@marketing.co" });
    const result = evaluateRules(msg, noDeleteAccount);
    expect(result).not.toBeNull();
    expect(result!.action).toBe("skip");
  });

  it("supports multiple actions via actions array", () => {
    const multiAccount: EmailAccount = {
      ...account,
      rules: [
        {
          match: { from: "*@customer.*" },
          action: "notify",
          actions: ["notify", "create_todo"],
        },
      ],
    };
    const msg = makeMessage({ from: "help@customer.io" });
    const result = evaluateRules(msg, multiAccount);
    expect(result!.actions).toEqual(["notify", "create_todo"]);
  });
});
