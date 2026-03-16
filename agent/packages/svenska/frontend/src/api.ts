const TOKEN = localStorage.getItem("svenska_token") ?? new URLSearchParams(window.location.search).get("token") ?? "";

if (TOKEN && !localStorage.getItem("svenska_token")) {
  localStorage.setItem("svenska_token", TOKEN);
  // Clean URL
  window.history.replaceState({}, "", window.location.pathname);
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("svenska_token");
      window.location.reload();
    }
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export interface Scenario {
  id: string;
  name: string;
  category: string;
  description: string;
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

export interface SessionSummary {
  patterns: string[];
  wins: string[];
  focus: string[];
}

export const getScenarios = () => api<Record<string, Scenario[]>>("/api/scenarios");

export const startConversation = (scenarioId: string) =>
  api<{ conversationId: string; firstMessage: { content: string } }>(
    "/api/conversation/start",
    { scenarioId }
  );

export const sendMessage = (conversationId: string, message: string) =>
  api<ConversationResponse>("/api/conversation/message", {
    conversationId,
    message,
  });

export const getSummary = (conversationId: string) =>
  api<SessionSummary>("/api/conversation/summary", { conversationId });

export const endConversation = (conversationId: string, scenarioId: string) =>
  api<{ ok: boolean }>("/api/conversation/end", { conversationId, scenarioId });

export const hasToken = () => !!TOKEN;
