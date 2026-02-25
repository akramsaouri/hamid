import { createHamidSession } from "@hamid/core";
import { GmailMessage, EmailAccount, TriageDecision } from "./types.js";

const JUDGE_PROMPT = `You are an email triage assistant. Your job is to classify emails into one of four actions:

- **trash**: Marketing, newsletters, automated notifications, spam, promotional content. Exception: keep emails about significant discounts or deals.
- **create_todo**: Emails that require action — invoices, requests, deadlines, approvals, tasks.
- **notify**: Emails from customers, users, or important contacts that need attention but aren't a specific task.
- **skip**: Informational emails that don't need action or deletion — receipts, confirmations, FYI threads.

You must respond with ONLY a JSON object, no other text:
{"action": "trash|create_todo|notify|skip", "priority": "high|medium|low", "reason": "brief explanation"}`;

export async function judgeEmail(
  message: GmailMessage,
  account: EmailAccount,
  accountName: string,
  workspaceDir: string
): Promise<TriageDecision> {
  const prompt = buildJudgePrompt(message, account, accountName);

  const session = createHamidSession({
    workingDir: workspaceDir,
    systemPrompt: JUDGE_PROMPT,
    onPermissionRequest: async () => ({ behavior: "deny" as const }),
  });

  let resultText = "";

  for await (const event of session.send(prompt)) {
    if (event.type === "result" || event.type === "text") {
      resultText += event.content;
    }
  }

  return parseJudgeResponse(resultText, account);
}

function buildJudgePrompt(
  message: GmailMessage,
  account: EmailAccount,
  accountName: string
): string {
  const bodyPreview = message.body.slice(0, 1000);

  return [
    `Account: ${accountName} (${account.address})`,
    `Allow deletion: ${account.allowDelete}`,
    account.rules.length > 0
      ? `Existing rules (for context): ${JSON.stringify(account.rules)}`
      : "No rules configured for this account.",
    "",
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `Date: ${message.date.toISOString()}`,
    `Labels: ${message.labels.join(", ")}`,
    "",
    `Body preview:`,
    bodyPreview,
  ].join("\n");
}

function parseJudgeResponse(
  text: string,
  account: EmailAccount
): TriageDecision {
  try {
    // Extract JSON from response (may have surrounding text)
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);

    let action = parsed.action || "skip";
    const priority = parsed.priority || "medium";
    const reason = parsed.reason || "AI judgment";

    // Respect allowDelete constraint
    if (!account.allowDelete && action === "trash") {
      action = "skip";
    }

    return { action, priority, reason, source: "ai" };
  } catch {
    // Default to skip on parse failure
    return {
      action: "skip",
      priority: "low",
      reason: "Failed to parse AI response, defaulting to skip",
      source: "ai",
    };
  }
}
