import { createLogger } from "@hamid/core";
import { loadConfig } from "./config.js";
import { runPermissionHygiene } from "./permission-hygiene.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

const log = createLogger("permission-hygiene");

await resilientRun("permission-hygiene", async () => {
  const cfg = loadConfig();

  log.info("Running permission hygiene...");
  const summary = await runPermissionHygiene(cfg.workspaceDir);

  log.info("Sending summary to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, summary);

  log.info("Permission hygiene complete.");
});
