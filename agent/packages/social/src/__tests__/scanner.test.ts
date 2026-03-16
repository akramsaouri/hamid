import { describe, it, expect } from "vitest";
import { filterNewThreads } from "../scanner.js";
import type { ScannedThread, SocialState } from "../types.js";
import { defaultState } from "../state.js";

function makeThread(id: string, author = "someone"): ScannedThread {
  return {
    id,
    subreddit: "fitness",
    title: "Test",
    body: "test body",
    url: `https://reddit.com/r/fitness/${id}`,
    author,
    upvotes: 10,
    commentCount: 5,
    createdAt: new Date().toISOString(),
  };
}

describe("filterNewThreads", () => {
  it("removes threads already in posted", () => {
    const state = defaultState();
    state.posted.push({
      id: "d1",
      platform: "reddit",
      threadId: "t3_abc",
      postId: "c1",
      postedAt: new Date().toISOString(),
      app: "przone",
      contentType: "value",
    });
    const threads = [makeThread("t3_abc"), makeThread("t3_new")];
    const result = filterNewThreads(threads, state, "botuser");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t3_new");
  });

  it("removes threads already in skipped", () => {
    const state = defaultState();
    state.skipped.push({
      threadId: "t3_skip",
      skippedAt: new Date().toISOString(),
    });
    const threads = [makeThread("t3_skip"), makeThread("t3_new")];
    const result = filterNewThreads(threads, state, "botuser");
    expect(result).toHaveLength(1);
  });

  it("removes threads by own account", () => {
    const state = defaultState();
    const threads = [makeThread("t3_mine", "botuser"), makeThread("t3_other")];
    const result = filterNewThreads(threads, state, "botuser");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t3_other");
  });

  it("removes threads already in queue", () => {
    const state = defaultState();
    state.queue.push({
      id: "d1",
      platform: "reddit",
      threadId: "t3_queued",
      subreddit: "fitness",
      threadTitle: "test",
      threadUrl: "",
      app: "przone",
      contentType: "value",
      draft: "test",
      confidence: 0.9,
      scannedAt: new Date().toISOString(),
      status: "pending",
    });
    const threads = [makeThread("t3_queued"), makeThread("t3_new")];
    const result = filterNewThreads(threads, state, "botuser");
    expect(result).toHaveLength(1);
  });
});
