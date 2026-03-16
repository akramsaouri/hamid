import { createHamidSession } from "@hamid/core";
import { buildSystemPrompt, buildSummaryPrompt } from "./prompt.js";
import type { Scenario, ConversationResponse, Message } from "./types.js";

interface ConversationState {
  scenario: Scenario;
  messages: Message[];
  totalCorrections: number;
}

const conversations = new Map<string, ConversationState>();

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function startConversation(scenario: Scenario): {
  conversationId: string;
  firstMessage: Message;
} {
  const id = generateId();
  const systemMessage: Message = {
    role: "system",
    content: scenario.setup,
  };
  conversations.set(id, {
    scenario,
    messages: [systemMessage],
    totalCorrections: 0,
  });
  return { conversationId: id, firstMessage: systemMessage };
}

export async function sendMessage(
  conversationId: string,
  userMessage: string,
  workingDir: string
): Promise<ConversationResponse> {
  const state = conversations.get(conversationId);
  if (!state) throw new Error("Conversation not found");

  state.messages.push({ role: "user", content: userMessage });

  const systemPrompt = buildSystemPrompt(state.scenario.prompt);
  const conversationContext = state.messages
    .map((m) => {
      if (m.role === "system") return `[Scene: ${m.content}]`;
      if (m.role === "user") return `User: ${m.content}`;
      return `Partner: ${m.content}`;
    })
    .join("\n");

  const session = createHamidSession({
    workingDir,
    systemPrompt,
    effort: "low",
    onPermissionRequest: async () => ({ behavior: "allow" as const }),
  });

  let resultText = "";
  for await (const event of session.send(conversationContext)) {
    if (event.type === "text") resultText += event.content;
    if (event.type === "result") resultText = event.content || resultText;
  }

  // Parse JSON from response — handle potential markdown fences
  const jsonStr = resultText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  let parsed: ConversationResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback if Claude doesn't return valid JSON
    parsed = {
      reply: resultText,
      corrections: [],
      positive: null,
      done: false,
    };
  }

  state.messages.push({
    role: "hamid",
    content: parsed.reply,
    corrections: parsed.corrections,
    positive: parsed.positive,
  });
  state.totalCorrections += parsed.corrections.length;

  return parsed;
}

export async function generateSummary(
  conversationId: string,
  workingDir: string
): Promise<{ patterns: string[]; wins: string[]; focus: string[] }> {
  const state = conversations.get(conversationId);
  if (!state) throw new Error("Conversation not found");

  const conversationContext = state.messages
    .map((m) => {
      if (m.role === "system") return `[Scene: ${m.content}]`;
      if (m.role === "user") return `User: ${m.content}`;
      return `Partner: ${m.content}`;
    })
    .join("\n");

  const summaryPrompt = buildSummaryPrompt();

  const session = createHamidSession({
    workingDir,
    systemPrompt: "You are a Swedish language tutor reviewing a practice session.",
    effort: "low",
    onPermissionRequest: async () => ({ behavior: "allow" as const }),
  });

  let resultText = "";
  for await (const event of session.send(
    conversationContext + "\n\n" + summaryPrompt
  )) {
    if (event.type === "text") resultText += event.content;
    if (event.type === "result") resultText = event.content || resultText;
  }

  const jsonStr = resultText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {
      patterns: ["Could not generate summary"],
      wins: [],
      focus: [],
    };
  }
}

export function getConversationState(conversationId: string) {
  return conversations.get(conversationId) ?? null;
}

export function endConversation(conversationId: string): number {
  const state = conversations.get(conversationId);
  const corrections = state?.totalCorrections ?? 0;
  conversations.delete(conversationId);
  return corrections;
}
