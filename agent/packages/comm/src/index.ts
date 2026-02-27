import { createLogger } from "@hamid/core";
import { loadConfig } from "./config.js";
import { createBot } from "./bot.js";
import { loadState, saveState } from "./state.js";

const log = createLogger("telegram");
const cfg = loadConfig();

// Record daemon boot time
const state = loadState();
state.startedAt = Date.now();
state.sessionCount = 0;
saveState(state);

const bot = createBot(cfg);

log.info("Hamid Telegram daemon starting...");
bot.start({
  onStart: () => log.info("Hamid is listening."),
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log.info("Shutting down...");
  bot.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  bot.stop();
  process.exit(0);
});
