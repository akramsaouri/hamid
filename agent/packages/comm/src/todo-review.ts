import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHamidSession } from "@hamid/core";

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

const SYSTEM_PROMPT = `You are Hamid, running a scheduled TODO review.

Your job: read TODO.md, verify each unchecked item against the actual workspace state, mark completed items, discover new TODO-worthy items, and add them.

## Process

### 1. Parse TODO.md
Read the file. Each line is either:
- \`- [ ] item\` (unchecked/pending)
- \`- [x] item\` (checked/done)

### 2. Verify each unchecked item
For each \`- [ ]\` item, inspect the workspace to determine if it's done:
- Check relevant config files, installed tools, git history, file existence
- Run read-only Bash commands: ls, cat, git log, git status, git diff, which, etc.
- Use Glob and Grep to search the codebase
- Be thorough but efficient — check the most likely evidence first

If an item is done, mark it \`- [x]\`.
If you cannot determine completion status, leave it unchanged and note it in your summary.

### 3. Discover new TODO-worthy items
Scan for things that should be tracked:
- Stale configurations or broken references
- Things mentioned in memory notes as planned but not tracked in TODO.md
- Missing integrations or setup steps visible in the workspace
- Don't add trivial items — only things that matter enough to track

Add new items as \`- [ ]\` at the end of the existing list.

### 4. Edit TODO.md
Use Edit to update the file. Only change check states and add new items.
Do NOT reorder, rephrase, or remove existing items.
Do NOT add metadata, dates, categories, or headings beyond what already exists.

Note: TODO.md is NOT git-tracked (it's in .gitignore). Do NOT attempt to git add or commit it.

### 5. Output summary
Write a concise plain-text summary:
- Items marked as done (and what evidence confirmed them)
- New items added (and why)
- Items that remain open
- Any items where completion status was unclear

No markdown formatting. Plain text only.

## Rules
- You are READ-ONLY for the workspace. You may NOT write code, fix bugs, or create files other than editing TODO.md.
- Only edit TODO.md. Nothing else.
- Only run read-only Bash commands (ls, cat, head, tail, git log, git status, git diff, git show, which, file, wc, etc.)
- Do NOT run: rm, mv, cp, mkdir, npm/pnpm install, git push, or any command that modifies files
- TODO.md is NOT git-tracked. Do NOT run git add or git commit.
- Be conservative with new items. If in doubt, don't add it.`;

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
    systemPrompt: SYSTEM_PROMPT,
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
