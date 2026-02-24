import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fetchWeather, checkHealth, gatherMemory, generateBriefing } from "../src/briefing.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock("@hamid/core", () => ({
  createHamidSession: vi.fn(() => ({
    send: async function* () {
      yield { type: "result", content: "Morning, Sat. It's cold.", sessionId: "test-123" };
    },
    sessionId: "test-123",
  })),
}));

describe("fetchWeather", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns formatted weather string from Open-Meteo", async () => {
    const mockResponse = {
      current: {
        temperature_2m: -4,
        apparent_temperature: -9,
        wind_speed_10m: 15,
        precipitation: 0,
        weather_code: 0,
      },
      daily: {
        temperature_2m_max: [-1],
        temperature_2m_min: [-6],
        precipitation_probability_max: [10],
      },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await fetchWeather();
    expect(result).toContain("-4");
    expect(result).toContain("-9");
    expect(result).toContain("-1");
    expect(result).toContain("Precipitation");
  });

  it("returns error string on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await fetchWeather();
    expect(result).toContain("unavailable");
  });
});

describe("checkHealth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns health info from launchctl and disk", () => {
    const mockExec = vi.mocked(execSync);
    mockExec.mockImplementation((cmd: string) => {
      if (cmd.includes("launchctl")) return "-\t0\tcom.hamid.telegram\n";
      if (cmd.includes("df")) return "Filesystem  Size  Used Avail Use% Mounted\n/dev/disk  500G  200G  300G  40% /\n";
      if (cmd.includes("tail")) return "[2026-02-19] Hamid is listening.\n";
      return "";
    });

    const result = checkHealth("/tmp/test-workspace");
    expect(result).toContain("com.hamid.telegram");
    expect(result).toContain("40%");
  });

  it("returns fallback strings when commands fail", () => {
    const mockExec = vi.mocked(execSync);
    mockExec.mockImplementation(() => { throw new Error("command failed"); });

    const result = checkHealth("/tmp/test-workspace");
    expect(result).toContain("no hamid services found");
    expect(result).toContain("check failed");
    expect(result).toContain("not available");
  });
});

describe("gatherMemory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads context.md and recent daily files", () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
    const oldDate = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);

    const todayStr = today.toISOString().slice(0, 10);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const oldStr = oldDate.toISOString().slice(0, 10);

    const mockReaddir = vi.mocked(readdirSync);
    mockReaddir.mockReturnValue([
      "context.md",
      `${todayStr}.md`,
      `${yesterdayStr}.md`,
      `${oldStr}.md`,
    ] as unknown as ReturnType<typeof readdirSync>);

    const mockReadFile = vi.mocked(readFileSync);
    mockReadFile.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith("context.md")) return "Running context here";
      if (p.endsWith(`${todayStr}.md`)) return "Today notes";
      if (p.endsWith(`${yesterdayStr}.md`)) return "Yesterday notes";
      if (p.endsWith(`${oldStr}.md`)) return "Old notes";
      return "";
    });

    const result = gatherMemory("/tmp/test-workspace");
    expect(result).toContain("context.md");
    expect(result).toContain("Running context here");
    expect(result).toContain(`${todayStr}.md`);
    expect(result).toContain("Today notes");
    expect(result).toContain(`${yesterdayStr}.md`);
    expect(result).toContain("Yesterday notes");
    // Old file (>7 days ago) should NOT appear
    expect(result).not.toContain("Old notes");
    expect(result).not.toContain(`${oldStr}.md`);
  });

  it("returns empty message when no memory dir", () => {
    const mockReaddir = vi.mocked(readdirSync);
    mockReaddir.mockImplementation(() => {
      const err = new Error("ENOENT: no such file or directory");
      (err as NodeJS.ErrnoException).code = "ENOENT";
      throw err;
    });

    const result = gatherMemory("/tmp/nonexistent");
    expect(result).toContain("No memory");
  });
});

describe("generateBriefing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a briefing string from Claude", async () => {
    // Mock fetch for weather
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        current: {
          temperature_2m: -2,
          apparent_temperature: -7,
          wind_speed_10m: 10,
          precipitation: 0,
          weather_code: 0,
        },
        daily: {
          temperature_2m_max: [1],
          temperature_2m_min: [-4],
          precipitation_probability_max: [20],
        },
      }),
    }));

    // Mock execSync for health checks
    const mockExec = vi.mocked(execSync);
    mockExec.mockImplementation((cmd: string) => {
      if (typeof cmd === "string" && cmd.includes("launchctl")) return "0\tcom.hamid.telegram\n";
      if (typeof cmd === "string" && cmd.includes("df")) return "Filesystem 500G 200G 300G 40% /\n";
      if (typeof cmd === "string" && cmd.includes("tail")) return "[2026-02-19] OK\n";
      return "";
    });

    // Mock fs for memory
    const mockReaddir = vi.mocked(readdirSync);
    mockReaddir.mockReturnValue(["context.md"] as unknown as ReturnType<typeof readdirSync>);
    const mockReadFile = vi.mocked(readFileSync);
    mockReadFile.mockReturnValue("Running context");

    const result = await generateBriefing("/tmp/workspace");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toBe("Morning, Sat. It's cold.");
  });
});
