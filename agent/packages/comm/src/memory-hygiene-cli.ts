import { loadConfig } from "./config.js";
import { runMemoryHygiene } from "./memory-hygiene.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

await resilientRun("memory-hygiene", async () => {
  const cfg = loadConfig();

  console.log("Running memory hygiene...");
  const summary = await runMemoryHygiene(cfg.workspaceDir);

  console.log("Sending summary to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, summary);

  console.log("Memory hygiene complete.");
});
