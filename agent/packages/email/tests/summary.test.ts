import { describe, it, expect } from "vitest";
import { formatTriageSummary } from "../src/summary.js";
import { TriageSweepResult, TriagedEmail } from "../src/types.js";

function makeTriaged(
  action: string,
  subject: string,
  from: string
): TriagedEmail {
  return {
    message: {
      id: "msg-1",
      threadId: "thread-1",
      from,
      to: "me@test.com",
      subject,
      snippet: subject,
      body: subject,
      date: new Date("2026-02-25"),
      labels: [],
    },
    account: "personal",
    decision: {
      action: action as any,
      priority: "medium",
      reason: "test",
      source: "rule",
    },
  };
}

describe("formatTriageSummary", () => {
  it("formats empty sweep", () => {
    const results: TriageSweepResult[] = [
      { account: "personal", timestamp: new Date(), results: [], errors: [] },
    ];
    const summary = formatTriageSummary(results);
    expect(summary).toContain("personal");
    expect(summary).toContain("No new emails");
  });

  it("groups actions by type", () => {
    const results: TriageSweepResult[] = [
      {
        account: "przone",
        timestamp: new Date(),
        results: [
          makeTriaged("create_todo", "User billing inquiry", "user@test.com"),
          makeTriaged("trash", "Newsletter #45", "news@marketing.co"),
          makeTriaged("trash", "Big sale!", "promo@store.com"),
        ],
        errors: [],
      },
    ];
    const summary = formatTriageSummary(results);
    expect(summary).toContain("Created todo");
    expect(summary).toContain("User billing inquiry");
    expect(summary).toContain("Trashed: 2");
  });

  it("shows multiple accounts", () => {
    const results: TriageSweepResult[] = [
      {
        account: "personal",
        timestamp: new Date(),
        results: [makeTriaged("trash", "Spam", "spam@junk.com")],
        errors: [],
      },
      {
        account: "wadrari",
        timestamp: new Date(),
        results: [
          makeTriaged("create_todo", "Contract review", "client@co.com"),
        ],
        errors: [],
      },
    ];
    const summary = formatTriageSummary(results);
    expect(summary).toContain("personal");
    expect(summary).toContain("wadrari");
  });

  it("includes errors if any", () => {
    const results: TriageSweepResult[] = [
      {
        account: "work",
        timestamp: new Date(),
        results: [],
        errors: ["Auth token expired"],
      },
    ];
    const summary = formatTriageSummary(results);
    expect(summary).toContain("Auth token expired");
  });
});
