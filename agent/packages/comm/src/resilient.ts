import { execFileSync } from "node:child_process";
import { createLogger, type Logger } from "@hamid/core";

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("fetch failed")) {
    return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("EADDRNOTAVAIL") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("EAI_AGAIN") ||
    msg.includes("UND_ERR_CONNECT_TIMEOUT")
  );
}

const retryLogger = createLogger("retry");

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    shouldRetry = isNetworkError,
  } = opts;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      retryLogger.warn(
        `Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay / 1000}s...`
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

async function isNetworkUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch("https://api.telegram.org", {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export async function waitForNetwork(
  timeoutMs: number = 10 * 60 * 1000
): Promise<boolean> {
  const start = Date.now();
  const pollIntervalMs = 15_000;

  while (Date.now() - start < timeoutMs) {
    if (await isNetworkUp()) return true;
    retryLogger.warn("Network not available, waiting 15s...");
    await sleep(pollIntervalMs);
  }
  return false;
}

export function notifyLocal(title: string, body: string): void {
  try {
    execFileSync("osascript", [
      "-e", "on run argv",
      "-e", "display notification (item 1 of argv) with title (item 2 of argv)",
      "-e", "end run",
      body, title,
    ]);
  } catch {
    // Last resort failed — nothing more we can do
  }
}

/**
 * Wraps a CLI task with network wait, retry, and fallback notification.
 * Handles process.exit — call this as the top-level entry point.
 */
export async function resilientRun(
  taskName: string,
  fn: () => Promise<void>
): Promise<void> {
  const log = createLogger(taskName);
  try {
    log.info("Waiting for network...");
    const networkUp = await waitForNetwork();
    if (!networkUp) {
      log.error("Network unavailable after 10 minutes.");
      notifyLocal("Hamid", `${taskName} failed: no network after 10 min`);
      process.exit(1);
    }

    log.info("Network up. Running task...");
    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 30_000,
    });

    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Failed after retries:", err);

    // Try Telegram notification (might work if only upstream service was down)
    try {
      const { loadConfig } = await import("./config.js");
      const { notify } = await import("./notify.js");
      const cfg = loadConfig();
      await notify(
        cfg.telegramBotToken,
        cfg.telegramChatId,
        `${taskName} failed after retries: ${msg}`
      );
    } catch {
      // Telegram also down — fall through to local notification
    }

    notifyLocal("Hamid", `${taskName} failed: ${msg.slice(0, 100)}`);
    process.exit(1);
  }
}
