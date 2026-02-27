import { createLogger } from "@hamid/core";
import { loadConfig } from "./config.js";
import { runMemoryHygiene } from "./memory-hygiene.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

const log = createLogger("memory-hygiene");

await resilientRun("memory-hygiene", async () => {
  const cfg = loadConfig();

  log.info("Running memory hygiene...");
  const summary = await runMemoryHygiene(cfg.workspaceDir);

  log.info("Sending summary to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, summary);

  log.info("Memory hygiene complete.");
});
