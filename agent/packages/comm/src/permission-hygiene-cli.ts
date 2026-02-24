import { loadConfig } from "./config.js";
import { runPermissionHygiene } from "./permission-hygiene.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

await resilientRun("permission-hygiene", async () => {
  const cfg = loadConfig();

  console.log("Running permission hygiene...");
  const summary = await runPermissionHygiene(cfg.workspaceDir);

  console.log("Sending summary to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, summary);

  console.log("Permission hygiene complete.");
});
