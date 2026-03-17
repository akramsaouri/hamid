import { GmailClient } from "./gmail.js";
import { loadCredentials, getAuthenticatedClient } from "./gmail-auth.js";
import { evaluateRules } from "./rules.js";
import { judgeEmail } from "./judge.js";
import { createEmailReminder } from "./reminders-todo.js";
import { isAccountDue } from "./schedule.js";
import { loadEmailState, saveEmailState } from "./state.js";
import {
  EmailConfig,
  EmailAccount,
  TriageSweepResult,
  TriagedEmail,
  GmailMessage,
} from "./types.js";

export interface TriageOptions {
  agentDir: string;
  workspaceDir: string;
  accountFilter?: string;
  forceRun?: boolean;
  dryRun?: boolean;
}

export async function runTriage(
  config: EmailConfig,
  options: TriageOptions
): Promise<TriageSweepResult[]> {
  const { agentDir, workspaceDir, accountFilter, forceRun, dryRun } = options;

  const creds = loadCredentials(agentDir);
  const state = loadEmailState(agentDir);
  const sweepResults: TriageSweepResult[] = [];

  const accountEntries = Object.entries(config.accounts).filter(
    ([name]) => !accountFilter || name === accountFilter
  );

  for (const [accountName, account] of accountEntries) {
    const lastChecked = state.accounts[accountName]?.lastCheckedAt || null;

    if (!forceRun && !isAccountDue(account.schedule, lastChecked)) {
      continue;
    }

    const sweepResult = await sweepAccount(
      accountName,
      account,
      creds,
      workspaceDir,
      dryRun
    );

    sweepResults.push(sweepResult);

    if (!dryRun) {
      state.accounts[accountName] = {
        lastCheckedAt: new Date().toISOString(),
      };
      saveEmailState(agentDir, state);
    }
  }

  return sweepResults;
}

async function sweepAccount(
  accountName: string,
  account: EmailAccount,
  creds: ReturnType<typeof loadCredentials>,
  workspaceDir: string,
  dryRun?: boolean
): Promise<TriageSweepResult> {
  const result: TriageSweepResult = {
    account: accountName,
    timestamp: new Date(),
    results: [],
    errors: [],
  };

  try {
    const envKey = `GMAIL_REFRESH_TOKEN_${accountName.toUpperCase()}`;
    const refreshToken = process.env[envKey];

    if (!refreshToken) {
      result.errors.push(`Missing ${envKey} in environment`);
      return result;
    }

    const auth = getAuthenticatedClient(creds, refreshToken);
    const gmail = new GmailClient(auth, account.address);

    const messages = await gmail.fetchUnread();
    const createdTodoKeys = new Set<string>();

    for (const message of messages) {
      try {
        let decision = evaluateRules(message, account);

        if (!decision) {
          decision = await judgeEmail(
            message,
            account,
            accountName,
            workspaceDir
          );
        }

        // Deduplicate todos for the same PR/project within a sweep
        const actions = decision.actions || [decision.action];
        if (actions.includes("create_todo")) {
          const dedupKey = extractDedupKey(message);
          if (dedupKey && createdTodoKeys.has(dedupKey)) {
            decision = {
              ...decision,
              action: "skip",
              actions: undefined,
              reason: `Deduped: ${decision.reason}`,
            };
          } else if (dedupKey) {
            createdTodoKeys.add(dedupKey);
          }
        }

        const triaged: TriagedEmail = {
          message,
          account: accountName,
          decision,
        };

        if (!dryRun) {
          const finalActions = decision.actions || [decision.action];
          for (const action of finalActions) {
            await executeAction(action, gmail, message, triaged);
          }
        }

        result.results.push(triaged);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(
          `Failed to process "${message.subject}": ${errMsg}`
        );
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Account sweep failed: ${errMsg}`);
  }

  return result;
}

async function executeAction(
  action: string,
  gmail: GmailClient,
  message: GmailMessage,
  triaged: TriagedEmail
): Promise<void> {
  switch (action) {
    case "trash":
      await gmail.trash(message.id);
      break;

    case "create_todo": {
      const gmailLink = await gmail.getGmailLink(message.id);
      await createEmailReminder({
        message,
        account: triaged.account,
        decision: triaged.decision,
        gmailLink,
      });
      await gmail.markAsRead(message.id);
      break;
    }

    case "notify":
      await gmail.markAsRead(message.id);
      break;

    case "skip":
      await gmail.markAsRead(message.id);
      break;
  }
}

function extractDedupKey(message: GmailMessage): string | null {
  // GitHub: "[owner/repo] Title (#123)"
  const ghMatch = message.subject.match(/\[([^\]]+)\].*#(\d+)/);
  if (ghMatch) return `${ghMatch[1]}#${ghMatch[2]}`;

  // Vercel: "Deployment failed for <project>"
  const vercelMatch = message.subject.match(/Deployment.*for\s+(\S+)/i);
  if (vercelMatch) return `vercel:${vercelMatch[1]}`;

  return null;
}
