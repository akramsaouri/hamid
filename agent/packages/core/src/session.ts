import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { PermissionEngine } from "./permissions.js";
import { loadSettings } from "./settings.js";
import { homedir } from "node:os";
import type {
  HamidEvent,
  HamidSession,
  HamidSessionOptions,
  PermissionDecision,
} from "./types.js";

function loadSoulPrompt(workingDir: string): string {
  try {
    return readFileSync(join(workingDir, "SOUL.md"), "utf-8");
  } catch {
    return "";
  }
}

interface PermissionLogEntry {
  ts: string;
  tool: string;
  command?: string;
  pattern?: string;
  result: string;
  source: string;
}

function logPermission(logPath: string, entry: PermissionLogEntry): void {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } catch {
    // Best-effort logging — don't break the session
  }
}

export function createHamidSession(options: HamidSessionOptions): HamidSession {
  const { workingDir, onPermissionRequest } = options;

  const rules = loadSettings(workingDir, homedir());
  const permissionEngine = new PermissionEngine(rules);
  const promptText = options.systemPrompt ?? loadSoulPrompt(workingDir);
  const permissionLogPath = options.permissionLogPath;

  let sessionId: string | null = options.sessionId ?? null;

  async function* send(message: string): AsyncGenerator<HamidEvent> {
    // Strip CLAUDECODE env var to allow spawning claude CLI from within a Claude Code session
    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;

    const queryOptions: Record<string, unknown> = {
      model: "claude-opus-4-6",
      cwd: workingDir,
      env: cleanEnv,
      includePartialMessages: true,
      mcpServers: {
        playwright: {
          command: "npx",
          args: ["@playwright/mcp@latest"],
        },
        notion: {
          command: "npx",
          args: ["-y", "@notionhq/notion-mcp-server"],
          env: {
            NOTION_TOKEN: process.env.NOTION_TOKEN ?? "",
          },
        },
        "apple-reminders": {
          command: "node",
          args: [join(workingDir, "tools/apple-reminders-mcp/dist/index.js")],
        },
      },
      systemPrompt: promptText
        ? {
            type: "preset" as const,
            preset: "claude_code" as const,
            append: promptText,
          }
        : undefined,
      canUseTool: async (
        toolName: string,
        input: unknown,
        _opts: { signal: AbortSignal; suggestions?: unknown[] }
      ) => {
        const detail = permissionEngine.checkDetailed(toolName, input);

        // Extract command for logging
        const command =
          toolName === "Bash" && input && typeof input === "object" && "command" in input
            ? String((input as { command: string }).command)
            : undefined;

        const logEntry: PermissionLogEntry = {
          ts: new Date().toISOString(),
          tool: toolName,
          ...(command && { command }),
          ...(detail.pattern && { pattern: detail.pattern }),
          result: detail.result,
          source: detail.source,
        };

        if (detail.result === "allow") {
          if (permissionLogPath) logPermission(permissionLogPath, logEntry);
          return { behavior: "allow" as const, updatedInput: input };
        }
        if (detail.result === "deny") {
          if (permissionLogPath) logPermission(permissionLogPath, logEntry);
          return {
            behavior: "deny" as const,
            message: "Denied by settings",
          };
        }

        // Need to ask the user (ask or ask_destructive)
        const request = {
          id: randomUUID(),
          toolName,
          input,
          isDestructive: detail.result === "ask_destructive",
        };

        const decision: PermissionDecision = await onPermissionRequest(request);

        // Log with the user's decision
        logEntry.result = decision.behavior === "deny" ? "user_denied" : "user_allowed";
        logEntry.source = decision.behavior === "allow_session" ? "user_session_grant" : "user";
        if (permissionLogPath) logPermission(permissionLogPath, logEntry);

        if (decision.behavior === "allow_session") {
          permissionEngine.addSessionGrant(toolName, input);
          return { behavior: "allow" as const, updatedInput: input };
        }
        if (decision.behavior === "allow") {
          return { behavior: "allow" as const, updatedInput: input };
        }
        return {
          behavior: "deny" as const,
          message: decision.message ?? "User denied",
        };
      },
    };

    if (sessionId) {
      queryOptions.resume = sessionId;
    }

    // Track tool state for stream events
    let currentTool: string | null = null;

    try {
      for await (const msg of query({
        prompt: message,
        options: queryOptions as any,
      })) {
        // Capture session ID from init
        if (msg.type === "system" && (msg as any).subtype === "init") {
          sessionId = (msg as any).session_id ?? sessionId;
        }

        // Stream events for tool tracking
        if (msg.type === "stream_event") {
          const event = (msg as any).event;

          if (event.type === "content_block_start") {
            if (event.content_block?.type === "tool_use") {
              currentTool = event.content_block.name;
              yield {
                type: "tool_start",
                toolName: currentTool!,
                input: event.content_block.input,
              };
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta?.type === "text_delta" && !currentTool) {
              yield { type: "text", content: event.delta.text };
            }
          } else if (event.type === "content_block_stop") {
            if (currentTool) {
              yield { type: "tool_end", toolName: currentTool };
              currentTool = null;
            }
          }
        }

        // Final result
        if (msg.type === "result") {
          const result = (msg as any).result ?? "";
          sessionId = (msg as any).session_id ?? sessionId;
          yield {
            type: "result",
            content: result,
            sessionId: sessionId ?? "",
          };
        }
      }
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    send,
    get sessionId() {
      return sessionId;
    },
  };
}
