import {
  TriageSweepResult,
  PendingTriagedEmail,
  PendingSweepResult,
} from "./types.js";

export function toPendingSweep(sweep: TriageSweepResult): PendingSweepResult {
  return {
    account: sweep.account,
    timestamp: sweep.timestamp.toISOString(),
    results: sweep.results.map((r) => ({
      from: r.message.from,
      subject: r.message.subject,
      account: r.account,
      action: r.decision.action,
      actions: r.decision.actions,
      priority: r.decision.priority,
      reason: r.decision.reason,
      source: r.decision.source,
    })),
    errors: sweep.errors,
  };
}

export function mergePendingSweeps(
  sweeps: PendingSweepResult[]
): PendingSweepResult[] {
  const merged = new Map<string, PendingSweepResult>();
  for (const sweep of sweeps) {
    const existing = merged.get(sweep.account);
    if (existing) {
      existing.results.push(...sweep.results);
      existing.errors.push(...sweep.errors);
    } else {
      merged.set(sweep.account, {
        ...sweep,
        results: [...sweep.results],
        errors: [...sweep.errors],
      });
    }
  }
  return [...merged.values()];
}

export function formatTriageSummary(
  sweeps: PendingSweepResult[],
  verbose = false
): string {
  const accountsSwept = sweeps.length;
  const lines: string[] = [
    `📧 **Email Triage** (${accountsSwept} account${accountsSwept === 1 ? "" : "s"})\n`,
  ];

  for (const sweep of sweeps) {
    lines.push(`**${sweep.account}:**`);

    if (sweep.errors.length > 0) {
      for (const err of sweep.errors) {
        lines.push(`  ⚠ ${err}`);
      }
    }

    if (sweep.results.length === 0 && sweep.errors.length === 0) {
      lines.push("  Nothing new");
      lines.push("");
      continue;
    }

    const grouped = groupByAction(sweep.results);

    if (grouped.create_todo.length > 0) {
      for (const email of grouped.create_todo) {
        const priority = email.priority === "high" ? " 🔴" : "";
        lines.push(`  ✅ Todo: "${email.subject}"${priority}`);
      }
    }

    if (grouped.notify.length > 0) {
      for (const email of grouped.notify) {
        lines.push(
          `  📬 ${extractSenderName(email.from)}: "${email.subject}"`
        );
      }
    }

    if (grouped.trash.length > 0) {
      if (verbose) {
        for (const email of grouped.trash) {
          const tag = email.source === "ai" ? " [AI]" : " [rule]";
          lines.push(
            `  🗑 "${email.subject}" from ${extractSenderName(email.from)}${tag}`
          );
        }
      } else {
        const senderSummary = deduplicateSenders(
          grouped.trash.map((e) => extractSenderName(e.from))
        );
        lines.push(`  🗑 Trashed ${grouped.trash.length} (${senderSummary})`);
      }
    }

    if (grouped.skip.length > 0) {
      if (verbose) {
        for (const email of grouped.skip) {
          const tag = email.source === "ai" ? " [AI]" : " [rule]";
          lines.push(
            `  ⏭ "${email.subject}" from ${extractSenderName(email.from)}${tag}`
          );
        }
      } else {
        lines.push(`  ⏭ Skipped ${grouped.skip.length}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

function deduplicateSenders(senders: string[]): string {
  const counts = new Map<string, number>();
  for (const s of senders) {
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => (count > 1 ? `${name} x${count}` : name))
    .join(", ");
}

function groupByAction(
  results: PendingTriagedEmail[]
): Record<string, PendingTriagedEmail[]> {
  const groups: Record<string, PendingTriagedEmail[]> = {
    create_todo: [],
    notify: [],
    trash: [],
    skip: [],
  };

  for (const result of results) {
    const actions = result.actions || [result.action];
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
