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
    propsScript = `{name:reminderName, body:reminderBody, priority:reminderPriority, due date:reminderDue}`;
    args.push(
      String(input.dueDate.getFullYear()),
      String(input.dueDate.getMonth() + 1),
      String(input.dueDate.getDate()),
      String(input.dueDate.getHours()),
      String(input.dueDate.getMinutes()),
    );
  }

  const script = input.dueDate
    ? `on run argv
  set reminderName to item 1 of argv
  set reminderBody to item 2 of argv
  set reminderPriority to (item 3 of argv) as integer
  set reminderYear to (item 4 of argv) as integer
  set reminderMonth to (item 5 of argv) as integer
  set reminderDay to (item 6 of argv) as integer
  set reminderHour to (item 7 of argv) as integer
  set reminderMinute to (item 8 of argv) as integer

  -- Build date from components to avoid locale issues
  set reminderDue to current date
  set year of reminderDue to reminderYear
  set month of reminderDue to reminderMonth
  set day of reminderDue to reminderDay
  set hours of reminderDue to reminderHour
  set minutes of reminderDue to reminderMinute
  set seconds of reminderDue to 0

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

  // Batch `name of (every reminder)` is fast (single Apple Event).
  // Use a custom delimiter since names can contain commas.
  const script = `tell application "Reminders"
  tell list ${JSON.stringify(listName)}
    set names_ to name of (every reminder whose completed is false)
    set AppleScript's text item delimiters to "|||"
    return names_ as text
  end tell
end tell`;

  const raw = await runOsascript(script);
  if (!raw) return [];

  return raw
    .split("|||")
    .filter((n) => n.trim())
    .map((name) => ({ name: name.trim(), body: "", dueDate: "" }));
}

export async function searchReminders(query: string, list?: string): Promise<Reminder[]> {
  // Use the fast batch fetch, then filter client-side.
  // Repeat loops in AppleScript are slow — client-side filtering is instant.
  const all = await getOpenReminders(list);
  const q = query.toLowerCase();
  return all.filter((r) => r.name.toLowerCase().includes(q));
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
