import type { JudgeInput, JudgeOutput, ContentType } from "./types.js";
import type { HamidSession } from "@hamid/core";

export function buildJudgePrompt(input: JudgeInput): string {
  const { thread, app, appKey, recentPostings } = input;

  const recentInSub = recentPostings.filter(
    (p) => p.platform === "reddit" && p.app === appKey,
  );
  const recentDirect = recentInSub.filter((p) => p.contentType === "direct");
  const recentSoft = recentInSub.filter((p) => p.contentType === "soft");

  return `You are evaluating a Reddit thread for potential engagement on behalf of an indie app developer.

## App
Name: ${app.name}
Features: ${app.features}
Voice: ${app.voice}

## Thread
Subreddit: r/${thread.subreddit}
Title: ${thread.title}
Body: ${thread.body || "(no body)"}
Upvotes: ${thread.upvotes} | Comments: ${thread.commentCount}
URL: ${thread.url}

## Recent Activity (last 7 days)
- Direct app mentions: ${recentDirect.length}
- Soft mentions: ${recentSoft.length}
- Total posts: ${recentInSub.length}

## Content Ratio Guidance
Aim for roughly 70% value-only replies (helpful, no app mention), 20% soft relevance (problem space, maybe indirect mention), 10% direct app mentions (only when someone explicitly asks for recommendations). Given recent activity above, lean toward the type that's underrepresented.

## Your Task
1. Decide if this thread is worth engaging with. If not, classify as "skip".
2. If engaging, classify as "value", "soft", or "direct" based on what's natural.
3. Draft a reply in the developer's voice. It must read as a real person, not a bot.
4. Rate your confidence that this engagement is natural and valuable (0.0 to 1.0).

Respond with ONLY this JSON (no markdown, no explanation):
{
  "classification": "value" | "soft" | "direct" | "skip",
  "draft": "your drafted reply here",
  "confidence": 0.85,
  "reasoning": "brief explanation of your decision"
}`;
}

export function buildKarmaPhasePrompt(thread: {
  subreddit: string;
  title: string;
  body: string;
}): string {
  return `You are helping build karma on a new Reddit account by writing genuinely helpful replies.

## Thread
Subreddit: r/${thread.subreddit}
Title: ${thread.title}
Body: ${thread.body || "(no body)"}

## Rules
- Be genuinely helpful and informative
- Write as a real person, conversational tone
- NO product mentions, NO self-promotion of any kind
- Keep it concise (2-4 sentences usually)
- If you can't add value, say so

Respond with ONLY this JSON:
{
  "classification": "value",
  "draft": "your helpful reply here",
  "confidence": 0.9,
  "reasoning": "brief explanation"
}`;
}

export async function judgeThread(
  input: JudgeInput,
  createSession: (opts: any) => HamidSession,
  workspaceDir: string,
): Promise<JudgeOutput> {
  const prompt = buildJudgePrompt(input);
  return runJudge(prompt, createSession, workspaceDir);
}

export async function judgeKarmaThread(
  thread: { subreddit: string; title: string; body: string },
  createSession: (opts: any) => HamidSession,
  workspaceDir: string,
): Promise<JudgeOutput> {
  const prompt = buildKarmaPhasePrompt(thread);
  return runJudge(prompt, createSession, workspaceDir);
}

async function runJudge(
  prompt: string,
  createSession: (opts: any) => HamidSession,
  workspaceDir: string,
): Promise<JudgeOutput> {
  const session = createSession({
    workingDir: workspaceDir,
    systemPrompt: "You are a social media engagement evaluator. Respond only with JSON.",
    onPermissionRequest: async () => ({ behavior: "deny" as const }),
  });

  let resultText = "";
  for await (const event of session.send(prompt)) {
    if (event.type === "text" || event.type === "result") {
      resultText += event.content;
    }
  }

  return parseJudgeResponse(resultText);
}

function parseJudgeResponse(text: string): JudgeOutput {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const validTypes = ["value", "soft", "direct", "skip"];
    const classification = validTypes.includes(parsed.classification)
      ? (parsed.classification as ContentType | "skip")
      : "skip";

    return {
      classification,
      draft: parsed.draft || "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reasoning: parsed.reason || parsed.reasoning || "No reasoning provided",
    };
  } catch {
    return {
      classification: "skip",
      draft: "",
      confidence: 0,
      reasoning: "Failed to parse AI response",
    };
  }
}
