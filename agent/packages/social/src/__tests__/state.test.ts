import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadState,
  saveState,
  pruneState,
  recordSnapshot,
  defaultState,
} from "../state.js";

describe("state", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "social-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  it("returns default state when file missing", () => {
    const state = loadState(dir);
    expect(state.karmaPhase).toBe(true);
    expect(state.queue).toEqual([]);
    expect(state.posted).toEqual([]);
    expect(state.skipped).toEqual([]);
  });

  it("round-trips state to disk", () => {
    const state = defaultState();
    state.cursors["reddit:r/fitness:gym"] = "t3_abc";
    saveState(dir, state);
    const loaded = loadState(dir);
    expect(loaded.cursors["reddit:r/fitness:gym"]).toBe("t3_abc");
  });

  it("prunes posted items older than 30 days", () => {
    const state = defaultState();
    const old = new Date();
    old.setDate(old.getDate() - 31);
    state.posted.push({
      id: "old",
      platform: "reddit",
      threadId: "t3_old",
      postId: "c_old",
      postedAt: old.toISOString(),
      app: "przone",
      contentType: "value",
    });
    state.posted.push({
      id: "new",
      platform: "reddit",
      threadId: "t3_new",
      postId: "c_new",
      postedAt: new Date().toISOString(),
      app: "przone",
      contentType: "value",
    });
    pruneState(state);
    expect(state.posted).toHaveLength(1);
    expect(state.posted[0].id).toBe("new");
  });

  it("prunes skipped items older than 30 days", () => {
    const state = defaultState();
    const old = new Date();
    old.setDate(old.getDate() - 31);
    state.skipped.push({ threadId: "t3_old", skippedAt: old.toISOString() });
    state.skipped.push({
      threadId: "t3_new",
      skippedAt: new Date().toISOString(),
    });
    pruneState(state);
    expect(state.skipped).toHaveLength(1);
  });

  it("records snapshot without duplicating same day", () => {
    const state = defaultState();
    recordSnapshot(state, 50, 3);
    expect(state.snapshots).toHaveLength(1);
    recordSnapshot(state, 55, 4);
    expect(state.snapshots).toHaveLength(1);
    expect(state.snapshots[0].redditKarma).toBe(55);
  });
});
