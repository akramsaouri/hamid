import { execFile } from "node:child_process";
import { GmailMessage, TriageDecision } from "./types.js";

export interface TodoInput {
  message: GmailMessage;
  account: string;
  decision: TriageDecision;
  gmailLink: string;
}

const PRIORITY_MAP: Record<string, number> = {
  high: 1,
  medium: 5,
  low: 9,
};

export async function createEmailReminder(input: TodoInput): Promise<void> {
  const { message, account, decision, gmailLink } = input;

  const name = decision.reason.startsWith("Matched rule:")
    ? message.subject
    : decision.reason;

  const body = [
    `From: ${message.from}`,
    `Account: ${account}`,
    `Link: ${gmailLink}`,
    `Reason: ${decision.reason}`,
  ].join("\n");

  const priority = PRIORITY_MAP[decision.priority] ?? 0;

  // Pass values as argv to avoid shell/AppleScript injection.
  // osascript - <args> reads script from stdin, passes args to `on run argv`.
  const script = `on run argv
  set reminderName to item 1 of argv
  set reminderBody to item 2 of argv
  set reminderPriority to (item 3 of argv) as integer

  tell application "Reminders"
    tell list "Tasks"
      make new reminder with properties {name:reminderName, body:reminderBody, priority:reminderPriority}
    end tell
  end tell
end run`;

  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      "osascript",
      ["-", name, body, String(priority)],
      (err) => {
        if (err)
          reject(new Error(`Failed to create reminder: ${err.message}`));
        else resolve();
      }
    );
    child.stdin?.end(script);
  });
}
