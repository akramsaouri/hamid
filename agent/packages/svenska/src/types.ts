export interface Scenario {
  id: string;
  name: string;
  category: string;
  description: string;
  prompt: string;
  setup: string;
}

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}

export interface ConversationResponse {
  reply: string;
  corrections: Correction[];
  positive: string | null;
  done: boolean;
}

export interface Message {
  role: "user" | "hamid" | "system";
  content: string;
  corrections?: Correction[];
  positive?: string | null;
}

export interface SessionRecord {
  date: string;
  scenario: string;
  corrections: number;
}

export interface SessionStore {
  sessions: SessionRecord[];
}
