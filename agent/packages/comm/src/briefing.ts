import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHamidSession, BRIEFING_PROMPT } from "@hamid/core";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const LATITUDE = 59.52;
const LONGITUDE = 17.92;
const TIMEZONE = "Europe/Stockholm";

export async function fetchWeather(): Promise<string> {
  try {
    const params = new URLSearchParams({
      latitude: String(LATITUDE),
      longitude: String(LONGITUDE),
      current: "temperature_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: TIMEZONE,
      forecast_days: "1",
    });

    const resp = await fetch(`${OPEN_METEO_URL}?${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const current = data.current;
    const daily = data.daily;

    return [
      `Current: ${current.temperature_2m}°C (feels like ${current.apparent_temperature}°C)`,
      `Wind: ${current.wind_speed_10m} km/h`,
      `Precipitation now: ${current.precipitation} mm`,
      `Today high: ${daily.temperature_2m_max[0]}°C, low: ${daily.temperature_2m_min[0]}°C`,
      `Precipitation probability: ${daily.precipitation_probability_max[0]}%`,
    ].join("\n");
  } catch {
    return "Weather data unavailable.";
  }
}

export function checkHealth(workspaceDir: string): string {
  try {
    const parts: string[] = [];

    try {
      const launchctl = execSync("launchctl list | grep hamid", { encoding: "utf-8" }).trim();
      parts.push(`Launchd services:\n${launchctl}`);
    } catch {
      parts.push("Launchd: no hamid services found");
    }

    try {
      const disk = execSync("df -h /", { encoding: "utf-8" }).trim();
      parts.push(`Disk:\n${disk}`);
    } catch {
      parts.push("Disk: check failed");
    }

    try {
      const logPath = join(workspaceDir, "logs", "telegram-stderr.log");
      const logs = execSync(`tail -20 "${logPath}"`, { encoding: "utf-8" }).trim();
      parts.push(`Recent logs:\n${logs}`);
    } catch {
      parts.push("Logs: not available");
    }

    return parts.join("\n\n");
  } catch {
    return "Health data unavailable.";
  }
}

export function gatherMemory(workspaceDir: string): string {
  try {
    const memoryDir = join(workspaceDir, "memory");
    const files = readdirSync(memoryDir, { encoding: "utf-8" });
    const parts: string[] = [];

    // Always include context.md
    if (files.includes("context.md")) {
      const content = readFileSync(join(memoryDir, "context.md"), "utf-8");
      parts.push(`--- context.md ---\n${content}`);
    }

    // Include daily files from the last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dailyFiles = files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .filter((f) => {
        const dateStr = f.replace(".md", "");
        const fileDate = new Date(dateStr + "T00:00:00");
        return fileDate >= sevenDaysAgo;
      })
      .sort()
      .reverse();

    for (const file of dailyFiles) {
      const content = readFileSync(join(memoryDir, file), "utf-8");
      parts.push(`--- ${file} ---\n${content}`);
    }

    return parts.length > 0 ? parts.join("\n\n") : "No memory files found.";
  } catch {
    return "No memory files available.";
  }
}

export async function generateBriefing(workspaceDir: string): Promise<string> {
  const [weather, health, memory] = await Promise.all([
    fetchWeather(),
    Promise.resolve(checkHealth(workspaceDir)),
    Promise.resolve(gatherMemory(workspaceDir)),
  ]);

  const rawData = [
    "=== WEATHER DATA ===",
    weather,
    "",
    "=== SERVICE HEALTH ===",
    health,
    "",
    "=== MEMORY FILES (last 7 days) ===",
    memory,
  ].join("\n");

  const session = createHamidSession({
    workingDir: workspaceDir,
    systemPrompt: BRIEFING_PROMPT,
    onPermissionRequest: async () => ({ behavior: "deny" as const, message: "Briefing is read-only" }),
  });

  let briefing = "";
  for await (const event of session.send(rawData)) {
    if (event.type === "text") {
      briefing += event.content;
    } else if (event.type === "result" && event.content) {
      briefing = event.content;
    }
  }

  return briefing.trim() || "Briefing generation failed.";
}
