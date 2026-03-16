import { describe, it, expect } from "vitest";
import { loadScenarios, getScenariosByCategory } from "./scenarios.js";

describe("loadScenarios", () => {
  it("loads scenarios from JSON file", () => {
    const scenarios = loadScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios[0]).toHaveProperty("id");
    expect(scenarios[0]).toHaveProperty("name");
    expect(scenarios[0]).toHaveProperty("category");
    expect(scenarios[0]).toHaveProperty("prompt");
    expect(scenarios[0]).toHaveProperty("setup");
  });
});

describe("getScenariosByCategory", () => {
  it("groups scenarios by category", () => {
    const scenarios = loadScenarios();
    const grouped = getScenariosByCategory(scenarios);
    expect(Object.keys(grouped).length).toBeGreaterThan(0);
    for (const [category, items] of Object.entries(grouped)) {
      expect(items.every((s) => s.category === category)).toBe(true);
    }
  });
});
