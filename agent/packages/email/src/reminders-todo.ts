import { createReminder } from "@hamid/reminders";
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

  await createReminder({ name, body, priority });
}
