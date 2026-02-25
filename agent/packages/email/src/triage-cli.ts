import { runTriage } from "./triage.js";
import type { EmailConfig } from "./types.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(__dirname, "..", "..", "..");

// Load .env
dotenvConfig({ path: resolve(agentDir, ".env") });

async function main() {
  // Dynamic import — use computed path so TypeScript doesn't try to compile
  // the config file (which is outside this package's rootDir)
  const configPath = resolve(agentDir, "config", "email-rules.js");
  const { config } = (await import(configPath)) as { config: EmailConfig };

  const accountFilter = process.argv[2]?.startsWith("--")
    ? undefined
    : process.argv[2];
  const forceRun = process.argv.includes("--force");

  const notionToken = process.env.NOTION_TOKEN;
  const notionDatabaseId = process.env.NOTION_EMAIL_TODOS_DB;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (!notionToken || !notionDatabaseId) {
    console.error("Missing NOTION_TOKEN or NOTION_EMAIL_TODOS_DB in .env");
    process.exit(1);
  }

  const summary = await runTriage(config, {
    agentDir,
    workspaceDir: resolve(agentDir, ".."),
    notionToken,
    notionDatabaseId,
    accountFilter,
    forceRun,
  });

  if (!summary) {
    console.log("No accounts due for sweep.");
    return;
  }

  console.log(summary);

  // Send to Telegram
  if (telegramToken && telegramChatId) {
    const commNotifyPath = resolve(
      agentDir,
      "packages",
      "comm",
      "dist",
      "notify.js"
    );
    const { notify } = (await import(commNotifyPath)) as {
      notify: (token: string, chatId: string, text: string) => Promise<void>;
    };
    await notify(telegramToken, telegramChatId, summary);
    console.log("Summary sent to Telegram.");
  }
}

main().catch((err) => {
  console.error("Triage failed:", err);
  process.exit(1);
});
