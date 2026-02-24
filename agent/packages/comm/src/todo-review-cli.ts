import { loadConfig } from "./config.js";
import { runTodoReview } from "./todo-review.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

await resilientRun("todo-review", async () => {
  const cfg = loadConfig();

  console.log("Running TODO review...");
  const summary = await runTodoReview(cfg.workspaceDir);

  console.log("Sending summary to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, summary);

  console.log("TODO review complete.");
});
