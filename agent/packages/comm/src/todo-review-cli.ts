import { createLogger } from "@hamid/core";
import { loadConfig } from "./config.js";
import { runTodoReview } from "./todo-review.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

const log = createLogger("todo-review");

await resilientRun("todo-review", async () => {
  const cfg = loadConfig();

  log.info("Running TODO review...");
  const summary = await runTodoReview(cfg.workspaceDir);

  log.info("Sending summary to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, summary);

  log.info("TODO review complete.");
});
