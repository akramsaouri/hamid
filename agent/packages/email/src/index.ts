export type {
  GmailMessage,
  EmailAccount,
  EmailAction,
  Priority,
  EmailRule,
  EmailMatch,
  EmailConfig,
  TriageDecision,
  TriagedEmail,
  TriageSweepResult,
  AccountState,
  EmailState,
} from "./types.js";

export {
  loadCredentials,
  createOAuth2Client,
  authorizeAccount,
  getAuthenticatedClient,
} from "./gmail-auth.js";
export type { GmailCredentials, GmailTokens } from "./gmail-auth.js";

export { GmailClient } from "./gmail.js";

export { matchRule, evaluateRules } from "./rules.js";

export { isAccountDue } from "./schedule.js";

export { judgeEmail } from "./judge.js";

export { createEmailTodo } from "./notion-todo.js";
export type { TodoInput } from "./notion-todo.js";
