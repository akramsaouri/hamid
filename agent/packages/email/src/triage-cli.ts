import { runTriage } from "./triage.js";
import { loadConfig } from "./config.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(__dirname, "..", "..", "..");

// Load .env
dotenvConfig({ path: resolve(agentDir, ".env") });

async function main() {

  const accountFilter = process.argv[2]?.startsWith("--")
    ? undefined
    : process.argv[2];
  const forceRun = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (dryRun) {
    console.log("DRY RUN — no actions will be executed\n");
  }

  const config = loadConfig();

  const summary = await runTriage(config, {
    agentDir,
    workspaceDir: resolve(agentDir, ".."),
    accountFilter,
    forceRun,
    dryRun,
  });

  if (!summary) {
    console.log("No accounts due for sweep.");
    return;
  }

  console.log(summary);

  // Send to Telegram (skip in dry run)
  if (!dryRun && telegramToken && telegramChatId) {
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
