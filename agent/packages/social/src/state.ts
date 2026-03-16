import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SocialState } from "./types.js";

const STATE_FILE = ".social-state.json";
const RETENTION_DAYS = 30;

export function defaultState(): SocialState {
  return {
    karmaPhase: true,
    cursors: {},
    queue: [],
    posted: [],
    skipped: [],
    stats: {
      totalScanned: 0,
      totalDrafted: 0,
      totalApproved: 0,
      totalSkipped: 0,
      totalPosted: 0,
    },
    snapshots: [],
  };
}

export function loadState(agentDir: string): SocialState {
  const path = resolve(agentDir, STATE_FILE);
  if (!existsSync(path)) return defaultState();
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function saveState(agentDir: string, state: SocialState): void {
  const path = resolve(agentDir, STATE_FILE);
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function pruneState(state: SocialState): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffISO = cutoff.toISOString();

  state.posted = state.posted.filter((p) => p.postedAt > cutoffISO);
  state.skipped = state.skipped.filter((s) => s.skippedAt > cutoffISO);

  // Keep only the latest snapshot per ISO week
  const byWeek = new Map<string, typeof state.snapshots[0]>();
  for (const snap of state.snapshots) {
    const d = new Date(snap.date);
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
    byWeek.set(key, snap); // later dates overwrite earlier ones in same week
  }
  state.snapshots = [...byWeek.values()];
}

export function recordSnapshot(
  state: SocialState,
  redditKarma: number,
  xFollowers: number,
): void {
  const today = new Date().toISOString().slice(0, 10);
  const existing = state.snapshots.findIndex((s) => s.date === today);
  const snap = { date: today, redditKarma, xFollowers };
  if (existing >= 0) {
    state.snapshots[existing] = snap;
  } else {
    state.snapshots.push(snap);
  }
}
