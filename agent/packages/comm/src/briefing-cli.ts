import { createLogger } from "@hamid/core";
import { loadConfig } from "./config.js";
import { generateBriefing } from "./briefing.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

const log = createLogger("briefing");

await resilientRun("briefing", async () => {
  const cfg = loadConfig();

  log.info("Generating daily briefing...");
  const briefing = await generateBriefing(cfg.workspaceDir);

  log.info("Sending to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, briefing);

  log.info("Briefing sent.");
});
