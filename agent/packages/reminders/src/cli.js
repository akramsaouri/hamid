import { createReminder, getOpenReminders, searchReminders, completeReminder } from "./reminders.js";
const PRIORITY_MAP = {
    high: 1,
    medium: 5,
    low: 9,
};
function parseArgs(args) {
    const positional = [];
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith("--")) {
            const key = args[i].slice(2);
            flags[key] = args[i + 1] ?? "";
            i++;
        }
        else {
            positional.push(args[i]);
        }
    }
    return { positional, flags };
}
async function main() {
    const [command, ...rest] = process.argv.slice(2);
    const { positional, flags } = parseArgs(rest);
    switch (command) {
        case "create": {
            const name = positional[0];
            if (!name) {
                console.error("Usage: reminders create <name> [--body ...] [--priority high|medium|low] [--due YYYY-MM-DD HH:MM] [--list ...]");
                process.exit(1);
            }
            const priority = flags.priority ? (PRIORITY_MAP[flags.priority] ?? 0) : 0;
            const dueDate = flags.due ? new Date(flags.due) : undefined;
            await createReminder({ name, body: flags.body, priority, dueDate, list: flags.list });
            console.log(`Created: ${name}`);
            break;
        }
        case "list": {
            const reminders = await getOpenReminders(flags.list);
            if (reminders.length === 0) {
                console.log("No open reminders.");
            }
            else {
                for (const r of reminders) {
                    const due = r.dueDate ? ` (due: ${r.dueDate})` : "";
                    console.log(`- ${r.name}${due}`);
                    if (r.body)
                        console.log(`  ${r.body.replace(/\n/g, "\n  ")}`);
                }
            }
            break;
        }
        case "search": {
            const query = positional[0];
            if (!query) {
                console.error("Usage: reminders search <query> [--list ...]");
                process.exit(1);
            }
            const results = await searchReminders(query, flags.list);
            if (results.length === 0) {
                console.log("No reminders found.");
            }
            else {
                for (const r of results) {
                    const due = r.dueDate ? ` (due: ${r.dueDate})` : "";
                    console.log(`- ${r.name}${due}`);
                    if (r.body)
                        console.log(`  ${r.body.replace(/\n/g, "\n  ")}`);
                }
            }
            break;
        }
        case "complete": {
            const name = positional[0];
            if (!name) {
                console.error("Usage: reminders complete <name> [--list ...]");
                process.exit(1);
            }
            await completeReminder(name, flags.list);
            console.log(`Completed: ${name}`);
            break;
        }
        default:
            console.error("Usage: reminders <create|list|search|complete> [args]");
            process.exit(1);
    }
}
main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map