import { loadConfig } from "./config.js";
import { generateBriefing } from "./briefing.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

await resilientRun("briefing", async () => {
  const cfg = loadConfig();

  console.log("Generating daily briefing...");
  const briefing = await generateBriefing(cfg.workspaceDir);

  console.log("Sending to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, briefing);

  console.log("Briefing sent.");
});
