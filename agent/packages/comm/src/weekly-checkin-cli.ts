import { writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { createLogger, createHamidSession, WEEKLY_CHECKIN_PROMPT } from "@hamid/core";
import { loadConfig } from "./config.js";
import { notify } from "./notify.js";
import { resilientRun } from "./resilient.js";

const log = createLogger("weekly-checkin");

const GOALS_DATA_SOURCE_ID = "00da20d6-cded-4db9-93d6-8ab936ba837e";

interface GoalInfo {
  name: string;
  status: string;
  year: string;
}

async function fetchActiveGoals(notionToken: string): Promise<GoalInfo[] | "NO_ACTIVE_GOALS"> {
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

  return data.results.map((page) => ({
    name: page.properties.Name.title.map((t) => t.plain_text).join(""),
    status: page.properties.Status.select?.name ?? "Unknown",
    year: page.properties.Year.select?.name ?? "No year",
  }));
}

async function fetchGoalReminders(goalNames: string[]): Promise<Map<string, string[]>> {
  const script = `on run
  set output to ""
  tell application "Reminders"
    tell list "Tasks"
      set goalReminders to every reminder whose body contains "Goal:"
      set reminderNames to name of goalReminders
      set reminderBodies to body of goalReminders
      set reminderCompleted to completed of goalReminders
      set reminderCount to count of reminderNames
      repeat with i from 1 to reminderCount
        set n to item i of reminderNames
        set b to item i of reminderBodies
        if item i of reminderCompleted then
          set s to "done"
        else
          set s to "open"
        end if
        set output to output & n & "|||" & b & "|||" & s & linefeed
      end repeat
    end tell
  end tell
  return output
end run`;

  const raw = await new Promise<string>((resolve, reject) => {
    const child = execFile("osascript", ["-"], (err, stdout) => {
      if (err) reject(new Error(`Failed to fetch reminders: ${err.message}`));
      else resolve(stdout);
    });
    child.stdin?.end(script);
  });

  const result = new Map<string, string[]>();
  for (const name of goalNames) {
    result.set(name, []);
  }

  for (const line of raw.trim().split("\n")) {
    if (!line.trim()) continue;
    const [name, body, status] = line.split("|||");
    if (!name || !body) continue;

    for (const goalName of goalNames) {
      if (body.includes(`Goal: ${goalName}`)) {
        result.get(goalName)!.push(`  - [${status}] ${name.trim()}`);
      }
    }
  }

  return result;
}

function formatGoalsWithReminders(goals: GoalInfo[], reminders: Map<string, string[]>): string {
  return goals
    .map((g) => {
      let line = `- ${g.name} | Status: ${g.status} | Year: ${g.year}`;
      const goalReminders = reminders.get(g.name) ?? [];
      if (goalReminders.length > 0) {
        line += "\n  Last week's actions:\n" + goalReminders.join("\n");
      } else {
        line += "\n  Last week's actions: none tracked";
      }
      return line;
    })
    .join("\n");
}

await resilientRun("weekly-checkin", async () => {
  const cfg = loadConfig();
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    throw new Error("NOTION_TOKEN must be set");
  }

  log.info("Fetching active goals from Notion...");
  const goals = await fetchActiveGoals(notionToken);

  if (goals === "NO_ACTIVE_GOALS") {
    log.info("No active goals. Sending nudge...");
    await notify(
      cfg.telegramBotToken,
      cfg.telegramChatId,
      "Monday morning. No active goals on the board right now. Want to set some for this quarter?"
    );
    return;
  }

  log.info("Fetching related reminders from Apple Reminders...");
  let reminders: Map<string, string[]>;
  try {
    reminders = await fetchGoalReminders(goals.map((g) => g.name));
  } catch (err) {
    log.warn(`Could not fetch reminders: ${err}. Continuing without them.`);
    reminders = new Map(goals.map((g) => [g.name, []]));
  }

  const goalsContext = formatGoalsWithReminders(goals, reminders);

  log.info("Generating check-in opening...");
  const session = createHamidSession({
    workingDir: cfg.workspaceDir,
    systemPrompt: WEEKLY_CHECKIN_PROMPT,
    onPermissionRequest: async () => ({
      behavior: "deny" as const,
      message: "Check-in is read-only",
    }),
  });

  let opening = "";
  for await (const event of session.send(
    `=== ACTIVE GOALS ===\n${goalsContext}`
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

  log.info("Sending to Telegram...");
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

  log.info("Weekly check-in sent. Marker file written.");
});
