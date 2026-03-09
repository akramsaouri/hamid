import { execFile } from "node:child_process";

export interface CreateReminderInput {
  name: string;
  body?: string;
  priority?: number; // 1=high, 5=medium, 9=low, 0=none
  dueDate?: Date;
  list?: string;
}

export interface Reminder {
  name: string;
  body: string;
  dueDate: string;
}

function runOsascript(script: string, args: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "osascript",
      ["-", ...args],
      { timeout: 15000 },
      (err, stdout) => {
        if (err) reject(new Error(`osascript failed: ${err.message}`));
        else resolve(stdout.trim());
      }
    );
    child.stdin?.end(script);
  });
}

function formatAppleScriptDate(date: Date): string {
  // Format as "March 16, 2026 9:00:00 AM" — AppleScript parses this reliably
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export async function createReminder(input: CreateReminderInput): Promise<void> {
  const list = input.list ?? "Tasks";
  const priority = input.priority ?? 0;

  let propsScript = `{name:reminderName, body:reminderBody, priority:reminderPriority}`;
  const args = [input.name, input.body ?? "", String(priority)];

  if (input.dueDate) {
    propsScript = `{name:reminderName, body:reminderBody, priority:reminderPriority, due date:date reminderDue}`;
    args.push(formatAppleScriptDate(input.dueDate));
  }

  const script = input.dueDate
    ? `on run argv
  set reminderName to item 1 of argv
  set reminderBody to item 2 of argv
  set reminderPriority to (item 3 of argv) as integer
  set reminderDue to item 4 of argv

  tell application "Reminders"
    tell list ${JSON.stringify(list)}
      make new reminder with properties ${propsScript}
    end tell
  end tell
end run`
    : `on run argv
  set reminderName to item 1 of argv
  set reminderBody to item 2 of argv
  set reminderPriority to (item 3 of argv) as integer

  tell application "Reminders"
    tell list ${JSON.stringify(list)}
      make new reminder with properties ${propsScript}
    end tell
  end tell
end run`;

  await runOsascript(script, args);
}

export async function getOpenReminders(list?: string): Promise<Reminder[]> {
  const listName = list ?? "Tasks";

  // Batch `name of (every reminder)` is fast.
  // `body of` errors when any reminder has missing value, so we fetch names only
  // and use a separate call for search when body is needed.
  const raw = await new Promise<string>((resolve, reject) => {
    execFile(
      "osascript",
      ["-e", `tell application "Reminders" to tell list ${JSON.stringify(listName)} to return name of (every reminder whose completed is false)`],
      { timeout: 15000 },
      (err, stdout) => {
        if (err) reject(new Error(`osascript failed: ${err.message}`));
        else resolve(stdout.trim());
      }
    );
  });

  if (!raw) return [];

  return raw
    .split(", ")
    .filter((n) => n.trim())
    .map((name) => ({ name: name.trim(), body: "", dueDate: "" }));
}

export async function searchReminders(query: string, list?: string): Promise<Reminder[]> {
  const listName = list ?? "Tasks";

  // Use AppleScript `whose name contains` for fast server-side filtering
  // Then fetch bodies individually for matching reminders (smaller set)
  const script = `on run argv
  set q to item 1 of argv
  tell application "Reminders"
    tell list ${JSON.stringify(listName)}
      set matches to every reminder whose completed is false and name contains q
      set output to ""
      repeat with r in matches
        set rName to name of r
        set rBody to ""
        try
          set rBody to body of r
          if rBody is missing value then set rBody to ""
        end try
        set output to output & rName & "\\t" & rBody & "\\n"
      end repeat
      return output
    end tell
  end tell
end run`;

  const raw = await runOsascript(script, [query]);
  if (!raw) return [];

  return raw
    .split("\n")
    .filter((line) => line.includes("\t"))
    .map((line) => {
      const idx = line.indexOf("\t");
      const name = line.slice(0, idx);
      const body = line.slice(idx + 1);
      return { name, body, dueDate: "" };
    });
}

export async function completeReminder(name: string, list?: string): Promise<void> {
  const listName = list ?? "Tasks";
  const script = `on run argv
  set targetName to item 1 of argv

  tell application "Reminders"
    tell list ${JSON.stringify(listName)}
      set matches to (every reminder whose name is targetName and completed is false)
      if (count of matches) > 0 then
        set completed of item 1 of matches to true
      else
        error "No open reminder found with name: " & targetName
      end if
    end tell
  end tell
end run`;

  await runOsascript(script, [name]);
}
