import "dotenv/config";
import { notify } from "@hamid/comm/dist/notify.js";
import {
  hasSessionToday,
  getConsecutiveMissedDays,
  getNudgeMessage,
} from "./accountability.js";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const sessionsFile =
    process.env.SVENSKA_SESSIONS_FILE ?? ".svenska-sessions.json";

  if (!token || !chatId) {
    console.error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required");
    process.exit(1);
  }

  // Only nudge on weekdays
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    console.log("Weekend — no nudge");
    return;
  }

  if (hasSessionToday(sessionsFile)) {
    console.log("Session completed today — no nudge needed");
    return;
  }

  const missed = getConsecutiveMissedDays(sessionsFile);
  const message = getNudgeMessage(missed);
  const appUrl = process.env.SVENSKA_APP_URL;
  const link = appUrl ? `\n\n[Öppna appen](${appUrl})` : "";

  await notify(token, chatId, `🇸🇪 *Svenska med Hamid*\n\n${message}${link}`);
  console.log(`Nudge sent (${missed} day(s) missed)`);
}

main().catch((err) => {
  console.error("Nudge failed:", err);
  process.exit(1);
});
