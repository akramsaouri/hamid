import { GmailClient } from "./gmail.js";
import { loadCredentials, getAuthenticatedClient } from "./gmail-auth.js";
import { evaluateRules } from "./rules.js";
import { judgeEmail } from "./judge.js";
import { createEmailTodo } from "./notion-todo.js";
import { isAccountDue } from "./schedule.js";
import { loadEmailState, saveEmailState } from "./state.js";
import { formatTriageSummary } from "./summary.js";
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
  notionToken: string;
  notionDatabaseId: string;
  accountFilter?: string;
  forceRun?: boolean;
}

export async function runTriage(
  config: EmailConfig,
  options: TriageOptions
): Promise<string> {
  const {
    agentDir,
    workspaceDir,
    notionToken,
    notionDatabaseId,
    accountFilter,
    forceRun,
  } = options;

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
      lastChecked,
      notionToken,
      notionDatabaseId,
      workspaceDir
    );

    sweepResults.push(sweepResult);

    state.accounts[accountName] = {
      lastCheckedAt: new Date().toISOString(),
    };
    saveEmailState(agentDir, state);
  }

  if (sweepResults.length === 0) {
    return "";
  }

  return formatTriageSummary(sweepResults);
}

async function sweepAccount(
  accountName: string,
  account: EmailAccount,
  creds: ReturnType<typeof loadCredentials>,
  lastChecked: string | null,
  notionToken: string,
  notionDatabaseId: string,
  workspaceDir: string
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

    const messages = lastChecked
      ? await gmail.fetchSince(new Date(lastChecked))
      : await gmail.fetchUnread();

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

        const triaged: TriagedEmail = {
          message,
          account: accountName,
          decision,
        };

        const actions = decision.actions || [decision.action];

        for (const action of actions) {
          await executeAction(
            action,
            gmail,
            message,
            triaged,
            notionToken,
            notionDatabaseId
          );
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
  triaged: TriagedEmail,
  notionToken: string,
  notionDatabaseId: string
): Promise<void> {
  switch (action) {
    case "trash":
      await gmail.trash(message.id);
      break;

    case "create_todo": {
      const gmailLink = await gmail.getGmailLink(message.id);
      await createEmailTodo(notionToken, notionDatabaseId, {
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
