import { createLogger } from "@hamid/core";
import { runTriage } from "./triage.js";
import { loadConfig } from "./config.js";
import { isAccountDue } from "./schedule.js";
import {
  appendPendingSweeps,
  consumePendingSweeps,
  getLastNotifiedAt,
} from "./state.js";
import {
  formatTriageSummary,
  toPendingSweep,
  mergePendingSweeps,
} from "./summary.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(__dirname, "..", "..", "..");

// Load .env
dotenvConfig({ path: resolve(agentDir, ".env") });

const log = createLogger("email-triage");

async function main() {
  const accountFilter = process.argv[2]?.startsWith("--")
    ? undefined
    : process.argv[2];
  const forceRun = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    log.info("DRY RUN — no actions will be executed");
  }

  const config = loadConfig();

  const sweeps = await runTriage(config, {
    agentDir,
    workspaceDir: resolve(agentDir, ".."),
    accountFilter,
    forceRun,
    dryRun,
  });

  if (sweeps.length === 0) {
    log.info("No accounts due for sweep.");
    return;
  }

  // Dry run: print immediately, no accumulation
  if (dryRun) {
    const summary = formatTriageSummary(sweeps.map(toPendingSweep));
    log.info(summary);
    return;
  }

  // Accumulate results for batched notification
  const pendingSweeps = sweeps.map(toPendingSweep);
  appendPendingSweeps(agentDir, pendingSweeps);
  log.info(`Processed ${sweeps.length} account(s), results saved to pending.`);

  // Check if notification is due
  const shouldNotify =
    forceRun ||
    (config.notifySchedule &&
      isAccountDue(config.notifySchedule, getLastNotifiedAt(agentDir)));

  if (!shouldNotify) {
    return;
  }

  // Consume all pending results and send batched summary
  const allPending = consumePendingSweeps(agentDir);
  if (allPending.length === 0) {
    return;
  }

  const merged = mergePendingSweeps(allPending);
  const summary = formatTriageSummary(merged);
  log.info(summary);

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

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
    log.info("Summary sent to Telegram.");
  }
}

main().catch((err) => {
  log.error("Triage failed:", err);
  process.exit(1);
});
