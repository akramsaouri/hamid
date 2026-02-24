import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface DaemonState {
  sessionId: string | null;
  lastActivity: number;
  startedAt: number;
  sessionCount: number;
}

const STATE_FILE = join(
  new URL("../../..", import.meta.url).pathname,
  ".state.json"
);
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function loadState(): DaemonState {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    } catch {
      // corrupted, start fresh
    }
  }
  return { sessionId: null, lastActivity: 0, startedAt: 0, sessionCount: 0 };
}

export function saveState(state: DaemonState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function isSessionExpired(state: DaemonState): boolean {
  if (!state.sessionId) return true;
  return Date.now() - state.lastActivity > SESSION_IDLE_TIMEOUT;
}
