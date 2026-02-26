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

  const escaped = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
tell application "Reminders"
  tell list "Tasks"
    make new reminder with properties {name:"${escaped(name)}", body:"${escaped(body)}", priority:${priority}}
  end tell
end tell`;

  await new Promise<void>((resolve, reject) => {
    execFile("osascript", ["-e", script], (err) => {
      if (err) reject(new Error(`Failed to create reminder: ${err.message}`));
      else resolve();
    });
  });
}
