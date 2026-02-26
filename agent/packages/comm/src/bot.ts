import { Bot } from "grammy";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHamidSession, type PermissionDecision } from "@hamid/core";
import { TelegramRenderer } from "./renderer.js";
import { loadState, saveState, isSessionExpired, type DaemonState } from "./state.js";
import type { CommConfig } from "./config.js";
import { transcribeVoice } from "./transcribe.js";
import { downloadTelegramFile } from "./media.js";

function log(msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function getGitStatus(cwd: string): string {
  try {
    const branch = execSync("git branch --show-current", { cwd, encoding: "utf-8" }).trim();
    const commitLine = execSync("git log --oneline -1", { cwd, encoding: "utf-8" }).trim();
    const dirty = execSync("git status --porcelain", { cwd, encoding: "utf-8" }).trim();
    const state = dirty ? "dirty" : "clean";
    return `${branch} @ ${commitLine} (${state})`;
  } catch {
    return "unknown";
  }
}

const GOAL_REVIEW_PROMPT = `You are conducting a weekly goal review with Sat.

Rules:
- Walk through each active goal ONE AT A TIME
- For each goal: ask about progress, discuss blockers, define 2-3 concrete next actions
- For stalled goals: gently probe why ("What's been getting in the way?"), let Sat decide priority
- Before discussing each goal, check last week's actions: use the Apple Reminders MCP (search_reminders) to find reminders whose notes contain the goal name. Note which are completed vs. still open — use this to ground the conversation.
- After discussing each goal, create an Apple Reminder for each next action using the Apple Reminders MCP (create_reminder in the "Tasks" list, due date next Monday). Include "Goal: <goal-name>" in the reminder notes so next week's review can find them.
- Update Status property via Notion MCP (patch-page) if Sat says it changed
- When all goals are reviewed, delete the marker file with: rm agent/.goal-review.json
  Then give a brief summary of what was committed to this week
- Conversational, not robotic. You're a thinking partner, not a project manager.`;

function getGoalReviewPrompt(workspaceDir: string): string | undefined {
  const markerPath = join(workspaceDir, "agent", ".goal-review.json");
  try {
    if (!existsSync(markerPath)) return undefined;
    const marker = JSON.parse(readFileSync(markerPath, "utf-8"));
    if (new Date(marker.expiresAt) < new Date()) {
      unlinkSync(markerPath);
      return undefined;
    }
    const soul = readFileSync(join(workspaceDir, "SOUL.md"), "utf-8");
    return soul + "\n\n" + GOAL_REVIEW_PROMPT;
  } catch {
    return undefined;
  }
}

export function createBot(cfg: CommConfig): Bot {
  const bot = new Bot(cfg.telegramBotToken);
  const state: DaemonState = loadState();

  // Map of pending permission requests: id -> resolve function
  const pendingPermissions = new Map<
    string,
    (decision: PermissionDecision) => void
  >();

  // Handle permission button callbacks
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("perm:")) return;

    const [, requestId, action] = data.split(":");
    const resolve = pendingPermissions.get(requestId);

    if (!resolve) {
      log(`Permission expired: ${requestId}`);
      await ctx.answerCallbackQuery({ text: "Expired" });
      return;
    }

    log(`Permission ${action}: ${requestId}`);
    pendingPermissions.delete(requestId);

    let decision: PermissionDecision;
    if (action === "allow") {
      decision = { behavior: "allow" };
    } else if (action === "allow_session") {
      decision = { behavior: "allow_session" };
    } else {
      decision = { behavior: "deny", message: "User denied via Telegram" };
    }

    resolve(decision);

    // Update the message to show decision
    const renderer = new TelegramRenderer(bot, String(ctx.chat?.id));
    await renderer.updatePermissionMessage(
      ctx.callbackQuery.message?.message_id ?? 0,
      action
    );

    await ctx.answerCallbackQuery();
  });

  // /new command — fresh session
  bot.command("new", async (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;
    log("Session reset via /new");
    state.sessionId = null;
    saveState(state);
    await ctx.reply("Fresh session. What's up?");
  });

  // /status command — system info
  bot.command("status", async (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;

    const model = "claude-opus-4-6";
    const git = getGitStatus(cfg.workspaceDir);
    const uptime = state.startedAt ? formatDuration(Date.now() - state.startedAt) : "unknown";
    const sessions = state.sessionCount;

    let sessionStatus: string;
    if (!state.sessionId) {
      sessionStatus = "none";
    } else if (isSessionExpired(state)) {
      sessionStatus = "expired";
    } else {
      const age = formatDuration(Date.now() - state.lastActivity);
      sessionStatus = `active (${age} ago)`;
    }

    const lines = [
      `Model: ${model}`,
      `Git: ${git}`,
      `Up since: ${uptime}`,
      `Sessions: ${sessions}`,
      `Current: ${sessionStatus}`,
    ];

    await ctx.reply(lines.join("\n"));
  });

  // /briefing command — generate and send daily briefing
  bot.command("briefing", async (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;
    log("Briefing requested via /briefing");
    await ctx.reply("Generating briefing...");

    try {
      const { generateBriefing } = await import("./briefing.js");
      const briefing = await generateBriefing(cfg.workspaceDir);
      await ctx.reply(briefing);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`Briefing error: ${msg}`);
      await ctx.reply(`Briefing failed: ${msg}`);
    }
  });

  // /email command — on-demand email triage
  bot.command("email", async (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;

    const accountFilter = ctx.match?.trim() || undefined;
    log(`Email triage requested${accountFilter ? ` (account: ${accountFilter})` : ""}`);
    const statusMsg = await ctx.reply("Checking email...");

    (async () => {
      try {
        const agentDir = resolve(cfg.workspaceDir, "agent");

        // Dynamic imports to avoid circular dependency with @hamid/email
        const configPath = resolve(agentDir, "packages", "email", "dist", "config.js");
        const triagePath = resolve(agentDir, "packages", "email", "dist", "triage.js");

        const { loadConfig } = (await import(configPath)) as { loadConfig: () => unknown };
        const { runTriage } = (await import(triagePath)) as {
          runTriage: (config: unknown, options: Record<string, unknown>) => Promise<string>;
        };

        const summary = await runTriage(loadConfig(), {
          agentDir,
          workspaceDir: cfg.workspaceDir,
          accountFilter,
          forceRun: true,
        });

        const reply = summary || "No new emails.";
        await bot.api.editMessageText(
          cfg.telegramChatId,
          statusMsg.message_id,
          reply
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`Email triage error: ${msg}`);
        await bot.api.editMessageText(
          cfg.telegramChatId,
          statusMsg.message_id,
          `Email triage failed: ${msg}`
        );
      }
    })();
  });

  // /todo-review command — on-demand TODO review
  bot.command("todo_review", async (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;
    log("TODO review requested via /todo_review");
    const statusMsg = await ctx.reply("Running TODO review...");

    (async () => {
      try {
        const { runTodoReview } = await import("./todo-review.js");
        const summary = await runTodoReview(cfg.workspaceDir);

        await bot.api.editMessageText(
          cfg.telegramChatId,
          statusMsg.message_id,
          summary || "TODO review completed — no changes."
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`TODO review error: ${msg}`);
        await bot.api.editMessageText(
          cfg.telegramChatId,
          statusMsg.message_id,
          `TODO review failed: ${msg}`
        );
      }
    })();
  });

  // /memory_hygiene command — on-demand memory maintenance
  bot.command("memory_hygiene", async (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;
    log("Memory hygiene requested via /memory_hygiene");
    const statusMsg = await ctx.reply("Running memory hygiene...");

    (async () => {
      try {
        const { runMemoryHygiene } = await import("./memory-hygiene.js");
        const summary = await runMemoryHygiene(cfg.workspaceDir);

        await bot.api.editMessageText(
          cfg.telegramChatId,
          statusMsg.message_id,
          summary || "Memory hygiene completed — no changes."
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`Memory hygiene error: ${msg}`);
        await bot.api.editMessageText(
          cfg.telegramChatId,
          statusMsg.message_id,
          `Memory hygiene failed: ${msg}`
        );
      }
    })();
  });

  // /permission_hygiene command — on-demand permission cleanup
  bot.command("permission_hygiene", async (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;
    log("Permission hygiene requested via /permission_hygiene");
    const statusMsg = await ctx.reply("Running permission hygiene...");

    (async () => {
      try {
        const { runPermissionHygiene } = await import("./permission-hygiene.js");
        const summary = await runPermissionHygiene(cfg.workspaceDir);

        await bot.api.editMessageText(
          cfg.telegramChatId,
          statusMsg.message_id,
          summary || "Permission hygiene completed — no changes."
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`Permission hygiene error: ${msg}`);
        await bot.api.editMessageText(
          cfg.telegramChatId,
          statusMsg.message_id,
          `Permission hygiene failed: ${msg}`
        );
      }
    })();
  });

  // /start command — greeting
  bot.command("start", async (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;
    await ctx.reply("Hamid is here. Send me anything.");
  });

  // Send a message to Claude — shared by text and voice handlers.
  // IMPORTANT: Don't await this — grammY processes updates sequentially,
  // so blocking would deadlock permission callbacks.
  function sendToHamid(text: string): void {
    const resuming = !isSessionExpired(state) && !!state.sessionId;
    if (!resuming) {
      state.sessionId = null;
      state.sessionCount++;
      saveState(state);
    }
    log(`Message: "${text.slice(0, 80)}" (${resuming ? `resume:${state.sessionId}` : "new session"})`);

    const renderer = new TelegramRenderer(bot, cfg.telegramChatId);

    (async () => {
      await renderer.sendTyping();

      const goalReviewPrompt = getGoalReviewPrompt(cfg.workspaceDir);

      const session = createHamidSession({
        workingDir: cfg.workspaceDir,
        ...(goalReviewPrompt && { systemPrompt: goalReviewPrompt }),
        sessionId: state.sessionId ?? undefined,
        permissionLogPath: join(cfg.workspaceDir, "logs", "permissions.jsonl"),
        onPermissionRequest: async (request) => {
          log(`Permission request: ${request.toolName}${request.isDestructive ? " (destructive)" : ""}`);
          return new Promise<PermissionDecision>((resolve) => {
            pendingPermissions.set(request.id, resolve);
            renderer.sendPermissionRequest(request, () => {});
          });
        },
      });

      try {
        for await (const event of session.send(text)) {
          await renderer.handleEvent(event);

          if (event.type === "result") {
            state.sessionId = event.sessionId;
            state.lastActivity = Date.now();
            saveState(state);
            log(`Done (session:${event.sessionId})`);
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`Error: ${msg}`);
        await renderer.handleEvent({ type: "error", message: msg });
      }
    })();
  }

  // Text messages
  bot.on("message:text", (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;
    const text = ctx.message.text.trim();
    if (!text) return;
    sendToHamid(text);
  });

  // Photos — download image, save to disk, tell Claude the path
  bot.on("message:photo", (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;

    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    const caption = ctx.message.caption?.trim();
    log("Photo received, downloading...");

    const renderer = new TelegramRenderer(bot, cfg.telegramChatId);

    (async () => {
      await renderer.sendTyping();

      try {
        const localPath = await downloadTelegramFile(
          cfg.telegramBotToken,
          largest.file_id,
          "jpg"
        );
        log(`Photo saved: ${localPath}`);

        const prompt = caption
          ? `[Image: ${localPath}]\n${caption}`
          : `[Image: ${localPath}]`;
        sendToHamid(prompt);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`Photo download error: ${msg}`);
        await renderer.handleEvent({ type: "error", message: `Failed to download photo: ${msg}` });
      }
    })();
  });

  // Voice notes — transcribe via Whisper, then send to Claude
  bot.on("message:voice", (ctx) => {
    if (String(ctx.chat.id) !== cfg.telegramChatId) return;

    const fileId = ctx.message.voice.file_id;
    log("Voice note received, transcribing...");

    const renderer = new TelegramRenderer(bot, cfg.telegramChatId);

    (async () => {
      await renderer.sendTyping();

      try {
        const transcription = await transcribeVoice(
          cfg.telegramBotToken,
          fileId,
          cfg.openaiApiKey
        );
        log(`Transcription: "${transcription.slice(0, 80)}"`);
        sendToHamid(`[Voice note transcription]: ${transcription}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(`Transcription error: ${msg}`);
        await renderer.handleEvent({ type: "error", message: `Failed to transcribe voice note: ${msg}` });
      }
    })();
  });

  return bot;
}
