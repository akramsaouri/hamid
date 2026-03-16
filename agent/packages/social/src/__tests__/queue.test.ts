import { describe, it, expect } from "vitest";
import { addDraft, skipDraft, approveDraft, autoSkipStale } from "../queue.js";
import { defaultState } from "../state.js";
import type { QueuedDraft } from "../types.js";

function makeDraft(overrides?: Partial<QueuedDraft>): QueuedDraft {
  return {
    id: "d1",
    platform: "reddit",
    threadId: "t3_abc",
    subreddit: "fitness",
    threadTitle: "Test thread",
    threadUrl: "https://reddit.com/r/fitness/t3_abc",
    app: "przone",
    contentType: "value",
    draft: "Great tip!",
    confidence: 0.9,
    scannedAt: new Date().toISOString(),
    status: "pending",
    ...overrides,
  };
}

describe("queue", () => {
  it("adds a draft to queue", () => {
    const state = defaultState();
    addDraft(state, makeDraft());
    expect(state.queue).toHaveLength(1);
    expect(state.stats.totalDrafted).toBe(1);
  });

  it("skips a draft", () => {
    const state = defaultState();
    addDraft(state, makeDraft());
    skipDraft(state, "d1");
    expect(state.queue).toHaveLength(0);
    expect(state.skipped).toHaveLength(1);
    expect(state.stats.totalSkipped).toBe(1);
  });

  it("approves a draft", () => {
    const state = defaultState();
    addDraft(state, makeDraft());
    const draft = approveDraft(state, "d1");
    expect(draft).toBeDefined();
    expect(draft!.status).toBe("approved");
  });

  it("auto-skips stale drafts", () => {
    const state = defaultState();
    const old = new Date();
    old.setHours(old.getHours() - 7);
    addDraft(state, makeDraft({ scannedAt: old.toISOString() }));
    addDraft(
      state,
      makeDraft({ id: "d2", threadId: "t3_new", scannedAt: new Date().toISOString() }),
    );
    const stale = autoSkipStale(state, 6);
    expect(stale).toHaveLength(1);
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].id).toBe("d2");
  });
});
