import {
  GmailMessage,
  EmailRule,
  EmailAccount,
  TriageDecision,
} from "./types.js";

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchRule(message: GmailMessage, rule: EmailRule): boolean {
  const { match } = rule;

  if (match.from && !globToRegex(match.from).test(message.from)) return false;
  if (match.to && !globToRegex(match.to).test(message.to)) return false;
  if (match.subject && !globToRegex(match.subject).test(message.subject))
    return false;

  // category is handled by AI judge, not rule matching
  if (match.category) return false;

  return true;
}

export function evaluateRules(
  message: GmailMessage,
  account: EmailAccount
): TriageDecision | null {
  for (const rule of account.rules) {
    if (!matchRule(message, rule)) continue;

    let action = rule.action;
    let actions = rule.actions;

    // Downgrade trash to skip if account disallows deletion
    if (!account.allowDelete) {
      if (action === "trash") action = "skip";
      if (actions) {
        actions = actions.map((a) => (a === "trash" ? "skip" : a));
      }
    }

    return {
      action,
      actions,
      priority: rule.priority || "medium",
      reason: `Matched rule: ${JSON.stringify(rule.match)}`,
      source: "rule",
    };
  }

  return null;
}
