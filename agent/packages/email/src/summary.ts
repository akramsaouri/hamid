import { TriageSweepResult, TriagedEmail } from "./types.js";

export function formatTriageSummary(
  sweeps: TriageSweepResult[],
  verbose = false
): string {
  const accountsSwept = sweeps.length;
  const lines: string[] = [
    `Email Triage (${accountsSwept} account${accountsSwept === 1 ? "" : "s"} swept)\n`,
  ];

  for (const sweep of sweeps) {
    lines.push(`${sweep.account}:`);

    if (sweep.errors.length > 0) {
      for (const err of sweep.errors) {
        lines.push(`  ⚠ Error: ${err}`);
      }
    }

    if (sweep.results.length === 0 && sweep.errors.length === 0) {
      lines.push("  No new emails");
      lines.push("");
      continue;
    }

    const grouped = groupByAction(sweep.results);

    // Todos created
    if (grouped.create_todo.length > 0) {
      for (const email of grouped.create_todo) {
        const priority =
          email.decision.priority === "high" ? " [HIGH]" : "";
        lines.push(
          `  ✓ Created todo: "${email.message.subject}"${priority}`
        );
      }
    }

    // Notifications
    if (grouped.notify.length > 0) {
      for (const email of grouped.notify) {
        lines.push(
          `  📬 ${email.message.from}: "${email.message.subject}"`
        );
      }
    }

    // Trashed
    if (grouped.trash.length > 0) {
      if (verbose) {
        for (const email of grouped.trash) {
          const tag = email.decision.source === "ai" ? " [AI]" : " [rule]";
          lines.push(
            `  🗑 Trash: "${email.message.subject}" from ${extractSenderName(email.message.from)}${tag}`
          );
        }
      } else {
        const senders = grouped.trash
          .map((e) => extractSenderName(e.message.from))
          .join(", ");
        lines.push(`  🗑 Trashed: ${grouped.trash.length} (${senders})`);
      }
    }

    // Skipped
    if (grouped.skip.length > 0) {
      if (verbose) {
        for (const email of grouped.skip) {
          const tag = email.decision.source === "ai" ? " [AI]" : " [rule]";
          lines.push(
            `  ⏭ Skip: "${email.message.subject}" from ${extractSenderName(email.message.from)}${tag}`
          );
        }
      } else {
        lines.push(`  ⏭ Skipped: ${grouped.skip.length} (no action needed)`);
      }
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

function groupByAction(
  results: TriagedEmail[]
): Record<string, TriagedEmail[]> {
  const groups: Record<string, TriagedEmail[]> = {
    create_todo: [],
    notify: [],
    trash: [],
    skip: [],
  };

  for (const result of results) {
    const actions = result.decision.actions || [result.decision.action];
    for (const action of actions) {
      if (groups[action]) {
        groups[action].push(result);
      }
    }
  }

  return groups;
}

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from;
}
