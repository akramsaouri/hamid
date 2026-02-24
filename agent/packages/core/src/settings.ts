import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PermissionRules } from "./types.js";

interface SettingsFile {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

function readSettingsFile(filePath: string): SettingsFile | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Load and merge Claude Code settings from project and global directories.
 * Reads up to 4 files (settings.json + settings.local.json from each).
 * Allow/deny lists are concatenated (project first, then global).
 */
export function loadSettings(projectDir: string, homeDir: string): PermissionRules {
  const allow: string[] = [];
  const deny: string[] = [];

  const files = [
    join(projectDir, ".claude", "settings.json"),
    join(projectDir, ".claude", "settings.local.json"),
    join(homeDir, ".claude", "settings.json"),
    join(homeDir, ".claude", "settings.local.json"),
  ];

  for (const file of files) {
    const settings = readSettingsFile(file);
    if (settings?.permissions?.allow) {
      allow.push(...settings.permissions.allow);
    }
    if (settings?.permissions?.deny) {
      deny.push(...settings.permissions.deny);
    }
  }

  return { allow, deny };
}

/**
 * Check if a permission pattern matches a tool invocation.
 *
 * Pattern formats:
 * - "Read"                    — exact tool name
 * - "Bash(git commit:*)"      — Bash command prefix
 * - "mcp__chrome-devtools__*" — wildcard suffix
 */
export function matchesPermissionPattern(
  pattern: string,
  toolName: string,
  input: unknown
): boolean {
  // Bash command pattern: "Bash(prefix:*)"
  const bashMatch = pattern.match(/^Bash\((.+?):\*\)$/);
  if (bashMatch) {
    if (toolName !== "Bash") return false;
    const prefix = bashMatch[1];
    const command =
      input && typeof input === "object" && "command" in input
        ? String((input as { command: string }).command)
        : "";
    return command.startsWith(prefix);
  }

  // Wildcard pattern: "mcp__chrome__*"
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return toolName.startsWith(prefix);
  }

  // Exact match
  return pattern === toolName;
}
