import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";
import { createHamidSession } from "@hamid/core";

const GOALS_DATA_SOURCE_ID = "00da20d6-cded-4db9-93d6-8ab936ba837e";

const CHECKIN_SYSTEM_PROMPT = `You are Hamid. Generate an opening message for Sat's weekly goal review.
Be direct, conversational, coaching — not robotic or project-manager-y. Use your voice from SOUL.md.

You'll receive a list of active goals with their status. Pick the most relevant one to start with
(the one with the most momentum or the one that needs the most attention) and open with it.

Format:
- Brief Monday morning greeting (one line, vary it)
- State how many active goals there are
- Start with the first goal: name it, note its status, and ask a specific question about progress

Keep it short. This is the start of a conversation, not a report.
Do NOT use markdown formatting. Plain text only.`;

async function fetchActiveGoals(notionToken: string): Promise<string> {
  const resp = await fetch(
    `https://api.notion.com/v1/databases/${GOALS_DATA_SOURCE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          or: [
            { property: "Status", select: { equals: "To Do" } },
            { property: "Status", select: { equals: "Doing" } },
          ],
        },
      }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Notion API failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    results: Array<{
      id: string;
      properties: {
        Name: { title: Array<{ plain_text: string }> };
        Status: { select: { name: string } | null };
        Year: { select: { name: string } | null };
      };
    }>;
  };

  if (data.results.length === 0) {
    return "NO_ACTIVE_GOALS";
  }

  return data.results
    .map((page) => {
      const name = page.properties.Name.title.map((t) => t.plain_text).join("");
      const status = page.properties.Status.select?.name ?? "Unknown";
      const year = page.properties.Year.select?.name ?? "No year";
      return `- ${name} | Status: ${status} | Year: ${year}`;
    })
    .join("\n");
}

await resilientRun("weekly-checkin", async () => {
  const cfg = loadConfig();
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    throw new Error("NOTION_TOKEN must be set");
  }

  console.log("Fetching active goals from Notion...");
  const goals = await fetchActiveGoals(notionToken);

  if (goals === "NO_ACTIVE_GOALS") {
    console.log("No active goals. Sending nudge...");
    await notify(
      cfg.telegramBotToken,
      cfg.telegramChatId,
      "Monday morning. No active goals on the board right now. Want to set some for this quarter?"
    );
    return;
  }

  console.log("Generating check-in opening...");
  const session = createHamidSession({
    workingDir: cfg.workspaceDir,
    systemPrompt: CHECKIN_SYSTEM_PROMPT,
    onPermissionRequest: async () => ({
      behavior: "deny" as const,
      message: "Check-in is read-only",
    }),
  });

  let opening = "";
  for await (const event of session.send(
    `=== ACTIVE GOALS ===\n${goals}`
  )) {
    if (event.type === "text") {
      opening += event.content;
    } else if (event.type === "result" && event.content) {
      opening = event.content;
    }
  }

  opening = opening.trim();
  if (!opening) {
    throw new Error("Failed to generate opening message");
  }

  console.log("Sending to Telegram...");
  await notify(cfg.telegramBotToken, cfg.telegramChatId, opening);

  // Write marker file for the bot to detect goal review mode
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const markerPath = join(cfg.workspaceDir, "agent", ".goal-review.json");
  writeFileSync(
    markerPath,
    JSON.stringify({
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
  );

  console.log("Weekly check-in sent. Marker file written.");
});
