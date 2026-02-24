import { config } from "dotenv";
import { join } from "node:path";

export interface CommConfig {
  telegramBotToken: string;
  telegramChatId: string;
  workspaceDir: string;
  openaiApiKey: string;
}

export function loadConfig(): CommConfig {
  // src/config.ts -> packages/comm/src/, so 3 levels up to agent/
  const agentDir = new URL("../../..", import.meta.url).pathname;
  config({ path: join(agentDir, ".env") });

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!telegramBotToken || !telegramChatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set");
  }
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY must be set");
  }

  // Workspace is one level up from agent/
  const workspaceDir = join(agentDir, "..");

  return { telegramBotToken, telegramChatId, workspaceDir, openaiApiKey };
}
