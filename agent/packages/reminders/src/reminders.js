import { execFile } from "node:child_process";
function runOsascript(script, args = []) {
    return new Promise((resolve, reject) => {
        const child = execFile("osascript", ["-", ...args], { timeout: 15000 }, (err, stdout) => {
            if (err)
                reject(new Error(`osascript failed: ${err.message}`));
            else
                resolve(stdout.trim());
        });
        child.stdin?.end(script);
    });
}
function formatAppleScriptDate(date) {
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
export async function createReminder(input) {
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
export async function getOpenReminders(list) {
    const listName = list ?? "Tasks";
    const script = `tell application "Reminders"
  tell list ${JSON.stringify(listName)}
    set openItems to every reminder whose completed is false
    set output to ""
    repeat with r in openItems
      set rName to name of r
      set rBody to body of r
      if rBody is missing value then set rBody to ""
      set rDue to due date of r
      if rDue is missing value then
        set rDueStr to ""
      else
        set rDueStr to (rDue as string)
      end if
      set output to output & rName & "\\t" & rBody & "\\t" & rDueStr & "\\n"
    end repeat
    return output
  end tell
end tell`;
    const raw = await runOsascript(script);
    if (!raw)
        return [];
    return raw
        .split("\n")
        .filter((line) => line.includes("\t"))
        .map((line) => {
        const [name, body, dueDate] = line.split("\t");
        return { name: name ?? "", body: body ?? "", dueDate: dueDate ?? "" };
    });
}
export async function searchReminders(query, list) {
    const all = await getOpenReminders(list);
    const q = query.toLowerCase();
    return all.filter((r) => r.name.toLowerCase().includes(q) || r.body.toLowerCase().includes(q));
}
export async function completeReminder(name, list) {
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
//# sourceMappingURL=reminders.js.map