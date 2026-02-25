// === Gmail Types ===

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: Date;
  labels: string[];
}

// === Config Types ===

export interface EmailAccount {
  address: string;
  schedule: string; // cron expression
  allowDelete: boolean;
  rules: EmailRule[];
}

export type EmailAction = "trash" | "notify" | "create_todo" | "skip";

export type Priority = "high" | "medium" | "low";

export interface EmailRule {
  match: EmailMatch;
  action: EmailAction;
  actions?: EmailAction[]; // multiple actions for one rule
  priority?: Priority;
}

export interface EmailMatch {
  from?: string; // glob pattern
  to?: string; // glob pattern
  subject?: string; // glob pattern
  category?: string; // AI-inferred category
}

export interface EmailConfig {
  accounts: Record<string, EmailAccount>;
}

// === Triage Types ===

export interface TriageDecision {
  action: EmailAction;
  actions?: EmailAction[];
  priority: Priority;
  reason: string;
  source: "rule" | "ai";
}

export interface TriagedEmail {
  message: GmailMessage;
  account: string;
  decision: TriageDecision;
}

export interface TriageSweepResult {
  account: string;
  timestamp: Date;
  results: TriagedEmail[];
  errors: string[];
}

// === State Types ===

export interface AccountState {
  lastCheckedAt: string; // ISO timestamp
  lastMessageId?: string;
}

export interface EmailState {
  accounts: Record<string, AccountState>;
}
