import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHamidSession, TODO_REVIEW_PROMPT } from "@hamid/core";

function loadTodoFile(workspaceDir: string): string {
  try {
    return readFileSync(join(workspaceDir, "TODO.md"), "utf-8");
  } catch {
    return "No TODO.md found.";
  }
}

function loadSkill(workspaceDir: string): string {
  try {
    return readFileSync(
      join(workspaceDir, ".claude", "skills", "todo-review", "SKILL.md"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

function gatherRecentContext(workspaceDir: string): string {
  const memoryDir = join(workspaceDir, "memory");
  const parts: string[] = [];

  // context.md for project awareness
  try {
    const context = readFileSync(join(memoryDir, "context.md"), "utf-8");
    parts.push(`--- context.md ---\n${context}`);
  } catch {
    // No context file
  }

  // Daily notes from last 7 days
  try {
    const files = readdirSync(memoryDir, { encoding: "utf-8" });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const recentDailies = files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f >= cutoffStr)
      .sort();

    for (const file of recentDailies) {
      const content = readFileSync(join(memoryDir, file), "utf-8");
      parts.push(`--- ${file} ---\n${content}`);
    }
  } catch {
    // No memory directory or files
  }

  return parts.length > 0 ? parts.join("\n\n") : "No recent context available.";
}

const ALLOWED_TOOLS = new Set(["Read", "Glob", "Grep", "Bash", "Edit", "Write"]);

const READ_ONLY_PREFIXES = [
  "git log",
  "git status",
  "git diff",
  "git show",
  "git branch",
  "git rev-parse",
  "git remote",
  "ls",
  "cat ",
  "head ",
  "tail ",
  "which ",
  "file ",
  "wc ",
  "find ",
  "test ",
  "stat ",
];

export async function runTodoReview(workspaceDir: string): Promise<string> {
  const todoContent = loadTodoFile(workspaceDir);
  const skill = loadSkill(workspaceDir);
  const recentContext = gatherRecentContext(workspaceDir);

  const prompt = [
    "=== SKILL: TODO REVIEW ===",
    skill,
    "",
    "=== CURRENT TODO.md ===",
    todoContent,
    "",
    "=== RECENT MEMORY (context on what's been happening) ===",
    recentContext,
    "",
    "Run the TODO review now. Check each item, update TODO.md if needed, and output a summary.",
  ].join("\n");

  const session = createHamidSession({
    workingDir: workspaceDir,
    systemPrompt: TODO_REVIEW_PROMPT,
    onPermissionRequest: async (req) => {
      if (req.toolName === "Read" || req.toolName === "Glob" || req.toolName === "Grep") {
        return { behavior: "allow" };
      }

      if (req.toolName === "Bash") {
        const input = req.input as { command?: string };
        const cmd = (input.command ?? "").trim();

        if (READ_ONLY_PREFIXES.some((p) => cmd.startsWith(p))) {
          return { behavior: "allow" };
        }

        return {
          behavior: "deny",
          message: "Only read-only commands allowed in TODO review mode",
        };
      }

      if (req.toolName === "Edit" || req.toolName === "Write") {
        const input = req.input as { file_path?: string };
        const filePath = input.file_path ?? "";
        if (filePath.endsWith("TODO.md")) {
          return { behavior: "allow" };
        }
        return { behavior: "deny", message: "Only TODO.md can be edited" };
      }

      return { behavior: "deny", message: "Not permitted in TODO review mode" };
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

  return result.trim() || "TODO review completed but produced no summary.";
}
