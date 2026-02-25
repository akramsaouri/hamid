import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { EmailState } from "./types.js";

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
