import { Bot, InlineKeyboard } from "grammy";
import type { HamidEvent, PermissionRequest } from "@hamid/core";
import { markdownToTelegram, chunkMessage } from "./format.js";

const TOOL_LABELS: Record<string, string> = {
  Read: "Reading",
  Write: "Writing",
  Edit: "Editing",
  Bash: "Running",
  Glob: "Searching files",
  Grep: "Searching code",
  WebSearch: "Searching web",
  WebFetch: "Fetching URL",
  Task: "Delegating",
};

function toolLabel(toolName: string, input: unknown): string {
  const label = TOOL_LABELS[toolName] ?? `Using ${toolName}`;
  if (toolName === "Bash" && input && typeof input === "object" && "command" in input) {
    const cmd = String((input as { command: string }).command);
    const short = cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd;
    return `${label}: ${short}`;
  }
  if (toolName === "Read" && input && typeof input === "object" && "file_path" in input) {
    const fp = String((input as { file_path: string }).file_path);
    const short = fp.split("/").slice(-2).join("/");
    return `${label} ${short}`;
  }
  return label;
}

/**
 * Manages sending streaming events to a Telegram chat.
 */
export class TelegramRenderer {
  private bot: Bot;
  private chatId: string;
  private statusMessageId: number | null = null;
  private textBuffer = "";

  constructor(bot: Bot, chatId: string) {
    this.bot = bot;
    this.chatId = chatId;
  }

  async sendTyping(): Promise<void> {
    try {
      await this.bot.api.sendChatAction(this.chatId, "typing");
    } catch {
      // non-critical
    }
  }

  async handleEvent(event: HamidEvent): Promise<void> {
    switch (event.type) {
      case "tool_start":
        await this.sendStatus(toolLabel(event.toolName, event.input));
        break;

      case "tool_end":
        // Status will be replaced by next event
        break;

      case "text":
        this.textBuffer += event.content;
        break;

      case "result":
        await this.clearStatus();
        await this.sendFinalResponse(event.content || this.textBuffer);
        this.textBuffer = "";
        break;

      case "error":
        await this.clearStatus();
        await this.sendPlain(`Error: ${event.message}`);
        break;
    }
  }

  /**
   * Send a permission request with inline keyboard.
   */
  async sendPermissionRequest(
    request: PermissionRequest,
    onDecision: (msgId: number) => void
  ): Promise<number> {
    await this.clearStatus();

    const label = toolLabel(request.toolName, request.input);
    const prefix = request.isDestructive ? "Warning — Hamid wants to run:" : "Hamid wants to run:";
    const text = `${prefix}\n> ${label}`;

    const keyboard = new InlineKeyboard();
    keyboard.text("Allow", `perm:${request.id}:allow`);
    if (!request.isDestructive) {
      keyboard.text("This session", `perm:${request.id}:allow_session`);
    }
    keyboard.text("Deny", `perm:${request.id}:deny`);

    const msg = await this.bot.api.sendMessage(this.chatId, text, {
      reply_markup: keyboard,
    });

    onDecision(msg.message_id);
    return msg.message_id;
  }

  /**
   * Update a permission message after user decision.
   */
  async updatePermissionMessage(
    messageId: number,
    decision: string
  ): Promise<void> {
    const label =
      decision === "allow"
        ? "Approved"
        : decision === "allow_session"
          ? "Approved (this session)"
          : "Denied";
    try {
      await this.bot.api.editMessageReplyMarkup(this.chatId, messageId);
      await this.bot.api.editMessageText(
        this.chatId,
        messageId,
        `${label}`
      );
    } catch {
      // Message may have been deleted
    }
  }

  private async sendStatus(text: string): Promise<void> {
    try {
      if (this.statusMessageId) {
        await this.bot.api.editMessageText(
          this.chatId,
          this.statusMessageId,
          text
        );
      } else {
        const msg = await this.bot.api.sendMessage(this.chatId, text);
        this.statusMessageId = msg.message_id;
      }
    } catch {
      // If edit fails, send new message
      const msg = await this.bot.api.sendMessage(this.chatId, text);
      this.statusMessageId = msg.message_id;
    }
  }

  private async clearStatus(): Promise<void> {
    if (this.statusMessageId) {
      try {
        await this.bot.api.deleteMessage(this.chatId, this.statusMessageId);
      } catch {
        // Already deleted or expired
      }
      this.statusMessageId = null;
    }
  }

  private async sendFinalResponse(text: string): Promise<void> {
    if (!text.trim()) return;
    const chunks = chunkMessage(text);
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      try {
        const formatted = markdownToTelegram(chunk);
        await this.bot.api.sendMessage(this.chatId, formatted, {
          parse_mode: "MarkdownV2",
        });
      } catch {
        await this.sendPlain(chunk);
      }
    }
  }

  private async sendPlain(text: string): Promise<void> {
    const chunks = chunkMessage(text);
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      await this.bot.api.sendMessage(this.chatId, chunk);
    }
  }
}
