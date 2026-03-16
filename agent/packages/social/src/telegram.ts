import type { QueuedDraft, SocialState } from "./types.js";
import { formatQueueItem } from "./summary.js";
import { saveState } from "./state.js";

const TELEGRAM_API = "https://api.telegram.org";

export async function sendSocialQueue(
  drafts: QueuedDraft[],
  botToken: string,
  chatId: string,
  state: SocialState,
  agentDir: string,
): Promise<void> {
  // Header message
  await sendMessage(
    botToken,
    chatId,
    `Social Queue — ${drafts.length} item${drafts.length === 1 ? "" : "s"} ready`,
  );

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const text = formatQueueItem(draft, i, drafts.length);

    const messageId = await sendMessageWithButtons(botToken, chatId, text, [
      [
        { text: "Approve", callback_data: `social:approve:${draft.id}` },
        { text: "Skip", callback_data: `social:skip:${draft.id}` },
      ],
    ]);

    draft.telegramMessageId = messageId;
  }

  saveState(agentDir, state);
}

export async function sendMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<number> {
  const resp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  const data = (await resp.json()) as { result: { message_id: number } };
  return data.result.message_id;
}

async function sendMessageWithButtons(
  token: string,
  chatId: string,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
): Promise<number> {
  const resp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: buttons },
    }),
  });
  const data = (await resp.json()) as { result: { message_id: number } };
  return data.result.message_id;
}
