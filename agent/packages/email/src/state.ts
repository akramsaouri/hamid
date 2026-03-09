import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { EmailState, PendingSweepResult } from "./types.js";

const STATE_FILE = ".email-state.json";

export function loadEmailState(agentDir: string): EmailState {
  const path = resolve(agentDir, STATE_FILE);
  if (!existsSync(path)) {
    return { accounts: {} };
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function saveEmailState(agentDir: string, state: EmailState): void {
  const path = resolve(agentDir, STATE_FILE);
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function appendPendingSweeps(
  agentDir: string,
  sweeps: PendingSweepResult[]
): void {
  const state = loadEmailState(agentDir);
  state.pendingSweeps = [...(state.pendingSweeps || []), ...sweeps];
  saveEmailState(agentDir, state);
}

export function consumePendingSweeps(
  agentDir: string
): PendingSweepResult[] {
  const state = loadEmailState(agentDir);
  const pending = state.pendingSweeps || [];
  state.pendingSweeps = [];
  state.lastNotifiedAt = new Date().toISOString();
  saveEmailState(agentDir, state);
  return pending;
}

export function getLastNotifiedAt(agentDir: string): string | null {
  const state = loadEmailState(agentDir);
  return state.lastNotifiedAt || null;
}
