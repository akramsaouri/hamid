import { loadConfig } from "./config.js";
import { notify, notifyFile } from "./notify.js";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: notify <message> | notify --file <path> [--caption <text>]");
  process.exit(1);
}

const cfg = loadConfig();

if (args[0] === "--file") {
  const filePath = args[1];
  const captionIdx = args.indexOf("--caption");
  const caption = captionIdx !== -1 ? args[captionIdx + 1] : undefined;
  if (!filePath) {
    console.error("Missing file path");
    process.exit(1);
  }
  await notifyFile(cfg.telegramBotToken, cfg.telegramChatId, filePath, caption);
  console.log("Sent.");
} else {
  const message = args.join(" ");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, message);
  console.log("Sent.");
}
