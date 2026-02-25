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
