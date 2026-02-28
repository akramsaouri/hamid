import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHamidSession, MEMORY_HYGIENE_PROMPT } from "@hamid/core";

function gatherAllMemory(workspaceDir: string): string {
  const memoryDir = join(workspaceDir, "memory");
  const files = readdirSync(memoryDir, { encoding: "utf-8" });
  const parts: string[] = [];

  // context.md first
  if (files.includes("context.md")) {
    const content = readFileSync(join(memoryDir, "context.md"), "utf-8");
    parts.push(`--- context.md ---\n${content}`);
  }

  // All daily notes (YYYY-MM-DD.md)
  const dailyFiles = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();

  for (const file of dailyFiles) {
    const content = readFileSync(join(memoryDir, file), "utf-8");
    parts.push(`--- ${file} ---\n${content}`);
  }

  // Weekly summaries (YYYY-WNN.md)
  const weeklyFiles = files
    .filter((f) => /^\d{4}-W\d{2}\.md$/.test(f))
    .sort();

  for (const file of weeklyFiles) {
    const content = readFileSync(join(memoryDir, file), "utf-8");
    parts.push(`--- ${file} ---\n${content}`);
  }

  // Archive files
  try {
    const archiveDir = join(memoryDir, "archive");
    const archiveFiles = readdirSync(archiveDir, { encoding: "utf-8" })
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of archiveFiles) {
      const content = readFileSync(join(archiveDir, file), "utf-8");
      parts.push(`--- archive/${file} ---\n${content}`);
    }
  } catch {
    // No archive directory yet
  }

  return parts.length > 0 ? parts.join("\n\n") : "No memory files found.";
}

function loadSkill(workspaceDir: string): string {
  try {
    return readFileSync(
      join(workspaceDir, ".claude", "skills", "memory-hygiene", "SKILL.md"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

const ALLOWED_TOOLS = new Set(["Read", "Write", "Edit", "Glob", "Grep", "Bash"]);

export async function runMemoryHygiene(workspaceDir: string): Promise<string> {
  const allMemory = gatherAllMemory(workspaceDir);
  const skill = loadSkill(workspaceDir);

  const prompt = [
    "=== SKILL: MEMORY HYGIENE ===",
    skill,
    "",
    "=== ALL MEMORY FILES ===",
    allMemory,
    "",
    "Run the memory hygiene process now. Read the files, update context.md, compress old dailies, and commit.",
  ].join("\n");

  const session = createHamidSession({
    workingDir: workspaceDir,
    systemPrompt: MEMORY_HYGIENE_PROMPT,
    onPermissionRequest: async (req) => {
      // Allow file operations and git commands scoped to workspace
      if (ALLOWED_TOOLS.has(req.toolName)) {
        // For Bash, only allow git commands
        if (req.toolName === "Bash") {
          const input = req.input as { command?: string };
          const cmd = input.command ?? "";
          if (cmd.startsWith("git ") || cmd.startsWith("mkdir ")) {
            return { behavior: "allow" };
          }
          return { behavior: "deny", message: "Only git and mkdir commands allowed" };
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

  return result.trim() || "Memory hygiene completed but produced no summary.";
}
