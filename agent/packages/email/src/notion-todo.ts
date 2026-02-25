import { createDatabasePage } from "@hamid/notion";
import { GmailMessage, TriageDecision } from "./types.js";

export interface TodoInput {
  message: GmailMessage;
  account: string;
  decision: TriageDecision;
  gmailLink: string;
}

export async function createEmailTodo(
  notionToken: string,
  databaseId: string,
  input: TodoInput
): Promise<{ id: string; url: string }> {
  const { message, account, decision, gmailLink } = input;

  const title = decision.reason.startsWith("Matched rule:")
    ? message.subject
    : decision.reason;

  const result = await createDatabasePage(notionToken, {
    database_id: databaseId,
    properties: {
      Name: {
        title: [{ text: { content: title } }],
      },
      Account: {
        select: { name: account },
      },
      From: {
        rich_text: [{ text: { content: message.from } }],
      },
      Priority: {
        select: { name: decision.priority },
      },
      Status: {
        status: { name: "Not started" },
      },
      "Source Email": {
        url: gmailLink,
      },
      Date: {
        date: { start: message.date.toISOString().split("T")[0] },
      },
    },
    blocks: [
      {
        type: "heading_3",
        text: message.subject,
      },
      {
        type: "paragraph",
        text: `From: ${message.from}`,
      },
      {
        type: "paragraph",
        text: message.snippet,
      },
      {
        type: "quote",
        text: decision.reason,
      },
    ],
  });

  return result as unknown as { id: string; url: string };
}
