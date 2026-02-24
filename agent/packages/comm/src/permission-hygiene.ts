import { readFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHamidSession } from "@hamid/core";

interface SettingsFileData {
  path: string;
  label: string;
  content: string;
}

function gatherSettingsFiles(workspaceDir: string): SettingsFileData[] {
  const home = homedir();
  const candidates = [
    { path: join(workspaceDir, ".claude", "settings.json"), label: "project settings.json" },
    { path: join(workspaceDir, ".claude", "settings.local.json"), label: "project settings.local.json" },
    { path: join(home, ".claude", "settings.json"), label: "global settings.json" },
    { path: join(home, ".claude", "settings.local.json"), label: "global settings.local.json" },
  ];

  const result: SettingsFileData[] = [];
  for (const { path, label } of candidates) {
    if (existsSync(path)) {
      try {
        result.push({ path, label, content: readFileSync(path, "utf-8") });
      } catch {
        // Skip unreadable files
      }
    }
  }
  return result;
}

interface LogSummary {
  totalChecks: number;
  toolCounts: Record<string, number>;
  patternHits: Record<string, number>;
  userApproved: Array<{ tool: string; command?: string; count: number }>;
  userDenied: Array<{ tool: string; command?: string; count: number }>;
}

function summarizePermissionLog(logPath: string): LogSummary | null {
  if (!existsSync(logPath)) return null;

  try {
    const lines = readFileSync(logPath, "utf-8").trim().split("\n").filter(Boolean);
    const entries = lines.map((l) => JSON.parse(l));

    const toolCounts: Record<string, number> = {};
    const patternHits: Record<string, number> = {};
    const userApprovedMap = new Map<string, { tool: string; command?: string; count: number }>();
    const userDeniedMap = new Map<string, { tool: string; command?: string; count: number }>();

    for (const entry of entries) {
      // Tool counts
      toolCounts[entry.tool] = (toolCounts[entry.tool] ?? 0) + 1;

      // Pattern hits
      if (entry.pattern) {
        patternHits[entry.pattern] = (patternHits[entry.pattern] ?? 0) + 1;
      }

      // User decisions
      const key = entry.command ? `${entry.tool}:${entry.command}` : entry.tool;
      if (entry.result === "user_allowed" || entry.result === "user_session_grant") {
        const existing = userApprovedMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          userApprovedMap.set(key, { tool: entry.tool, command: entry.command, count: 1 });
        }
      } else if (entry.result === "user_denied") {
        const existing = userDeniedMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          userDeniedMap.set(key, { tool: entry.tool, command: entry.command, count: 1 });
        }
      }
    }

    return {
      totalChecks: entries.length,
      toolCounts,
      patternHits,
      userApproved: [...userApprovedMap.values()].sort((a, b) => b.count - a.count),
      userDenied: [...userDeniedMap.values()].sort((a, b) => b.count - a.count),
    };
  } catch {
    return null;
  }
}

function loadSkill(workspaceDir: string): string {
  try {
    return readFileSync(
      join(workspaceDir, ".claude", "skills", "permission-hygiene", "SKILL.md"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

function rotatePermissionLog(logPath: string): void {
  if (!existsSync(logPath)) return;
  try {
    renameSync(logPath, logPath + ".prev");
  } catch {
    // Best-effort rotation
  }
}

const ALLOWED_TOOLS = new Set(["Read", "Write", "Edit", "Glob", "Grep", "Bash"]);

const SYSTEM_PROMPT = `You are Hamid, running a scheduled permission hygiene task.

Your job: analyze permission settings and usage data, consolidate redundant patterns, add missing patterns for frequently approved commands, and update settings files.

You have read/write access to the workspace and settings files. Use it.

Rules:
- Only modify settings.local.json files (never settings.json)
- Never modify deny lists
- Never add destructive command patterns
- Preserve non-permission keys in settings files
- Be conservative — when unsure, don't change
- After all changes, output a short summary of what you did. Plain text, no markdown.`;

export async function runPermissionHygiene(workspaceDir: string): Promise<string> {
  const settingsFiles = gatherSettingsFiles(workspaceDir);
  const logPath = join(workspaceDir, "logs", "permissions.jsonl");
  const logSummary = summarizePermissionLog(logPath);
  const skill = loadSkill(workspaceDir);

  if (!logSummary && settingsFiles.length === 0) {
    return "No permission data to analyze.";
  }

  const prompt = [
    "=== SKILL: PERMISSION HYGIENE ===",
    skill,
    "",
    "=== SETTINGS FILES ===",
    ...settingsFiles.map((f) => `--- ${f.label} (${f.path}) ---\n${f.content}`),
    "",
    "=== PERMISSION LOG SUMMARY ===",
    logSummary
      ? JSON.stringify(logSummary, null, 2)
      : "No permission log data available yet. Just review and consolidate existing settings.",
    "",
    "Run the permission hygiene process now. Read the settings files, analyze usage, consolidate patterns, and update settings.local.json files as needed.",
  ].join("\n");

  const session = createHamidSession({
    workingDir: workspaceDir,
    systemPrompt: SYSTEM_PROMPT,
    onPermissionRequest: async (req) => {
      if (ALLOWED_TOOLS.has(req.toolName)) {
        if (req.toolName === "Bash") {
          const input = req.input as { command?: string };
          const cmd = input.command ?? "";
          if (cmd.startsWith("cat ")) {
            return { behavior: "allow" };
          }
          return { behavior: "deny", message: "Only cat commands allowed" };
        }
        return { behavior: "allow" };
      }
      return { behavior: "deny", message: "Not permitted in maintenance mode" };
    },
  });

  let result = "";
  for await (const event of session.send(prompt)) {
    if (event.type === "text") {
      result += event.content;
    } else if (event.type === "result" && event.content) {
      result = event.content;
    }
  }

  // Rotate the log after analysis
  rotatePermissionLog(logPath);

  return result.trim() || "Permission hygiene completed but produced no summary.";
}
