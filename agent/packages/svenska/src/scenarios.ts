import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Scenario } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadScenarios(): Scenario[] {
  // From src/ or dist/, go up one level to package root, then into scenarios/
  const scenariosPath = join(__dirname, "..", "scenarios", "scenarios.json");
  const raw = readFileSync(scenariosPath, "utf-8");
  return JSON.parse(raw) as Scenario[];
}

export function getScenariosByCategory(
  scenarios: Scenario[]
): Record<string, Scenario[]> {
  const grouped: Record<string, Scenario[]> = {};
  for (const s of scenarios) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }
  return grouped;
}
