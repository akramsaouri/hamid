import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { markdownToTelegram, chunkMessage } from "./format.js";
import { withRetry } from "./resilient.js";

const TELEGRAM_API = "https://api.telegram.org/bot";

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

async function telegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<unknown> {
  return withRetry(
    async () => {
      const resp = await fetch(`${TELEGRAM_API}${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        const err = new Error(
          `Telegram API ${method} failed: ${resp.status} ${text}`
        );
        (err as any).status = resp.status;
        throw err;
      }
      return resp.json();
    },
    {
      maxAttempts: 3,
      baseDelayMs: 2000,
      shouldRetry: (err) => {
        if ((err as any).status && !isRetryableStatus((err as any).status)) {
          return false; // Don't retry 4xx client errors
        }
        return true; // Retry network errors and 5xx/429
      },
    }
  );
}

/**
 * Send a text message to Telegram.
 * Attempts MarkdownV2 formatting, falls back to plain text.
 */
export async function notify(
  token: string,
  chatId: string,
  text: string
): Promise<void> {
  const chunks = chunkMessage(text);
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    try {
      const formatted = markdownToTelegram(chunk);
      await telegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: formatted,
        parse_mode: "MarkdownV2",
      });
    } catch {
      // Fallback to plain text
      await telegramApi(token, "sendMessage", {
        chat_id: chatId,
        text: chunk,
      });
    }
  }
}

/**
 * Send a file to Telegram.
 */
export async function notifyFile(
  token: string,
  chatId: string,
  filePath: string,
  caption?: string
): Promise<void> {
  const fileData = readFileSync(filePath);
  const fileName = basename(filePath);

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("document", new Blob([fileData]), fileName);
  if (caption) form.append("caption", caption);

  const resp = await fetch(`${TELEGRAM_API}${token}/sendDocument`, {
    method: "POST",
    body: form,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`sendDocument failed: ${resp.status} ${text}`);
  }
}
