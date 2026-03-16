import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { SessionStore } from "./types.js";

const DEFAULT_PATH = ".svenska-sessions.json";

function loadStore(filePath: string): SessionStore {
  if (!existsSync(filePath)) return { sessions: [] };
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return { sessions: [] };
  }
}

function saveStore(store: SessionStore, filePath: string): void {
  writeFileSync(filePath, JSON.stringify(store, null, 2));
}

export function recordSession(
  scenarioId: string,
  corrections: number,
  filePath: string = DEFAULT_PATH
): void {
  const store = loadStore(filePath);
  const today = new Date().toISOString().split("T")[0];
  store.sessions.push({ date: today, scenario: scenarioId, corrections });
  saveStore(store, filePath);
}

export function hasSessionToday(filePath: string = DEFAULT_PATH): boolean {
  const store = loadStore(filePath);
  const today = new Date().toISOString().split("T")[0];
  return store.sessions.some((s) => s.date === today);
}

export function getConsecutiveMissedDays(
  filePath: string = DEFAULT_PATH
): number {
  const store = loadStore(filePath);
  if (store.sessions.length === 0) return 1;

  const today = new Date();
  let missed = 0;

  // Walk backwards through weekdays
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.getDay();
    // Skip weekends
    if (day === 0 || day === 6) continue;

    const dateStr = d.toISOString().split("T")[0];

    // Skip today (we're checking if they haven't practiced yet)
    if (i === 0) {
      if (!store.sessions.some((s) => s.date === dateStr)) missed++;
      continue;
    }

    if (store.sessions.some((s) => s.date === dateStr)) break;
    missed++;
  }

  return missed;
}

export function getNudgeMessage(missedDays: number): string {
  if (missedDays <= 1) {
    return "Har du glömt svenska idag? Hoppa in när du har en stund.";
  }
  if (missedDays <= 3) {
    return `Det har gått ${missedDays} dagar sedan du övade. Vill du köra ett snabbt scenario?`;
  }
  return `Du har inte övat svenska på ${missedDays} dagar. Vad hindrar dig? Ska vi anpassa schemat?`;
}
