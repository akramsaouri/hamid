import type { AppConfig, GeneratedTweet } from "./types.js";
import type { HamidSession } from "@hamid/core";

export function buildContentPrompt(app: AppConfig): string {
  return `You are a solo indie app developer posting on X (Twitter) about your app.

## App
Name: ${app.name}
Features: ${app.features}
Voice: ${app.voice}
Hashtags to use: ${app.twitter.hashtags.map((h) => `#${h}`).join(" ")}
Content themes: ${app.twitter.contentThemes.join("; ")}

## Rules
- Write ONE tweet (max 280 characters including hashtags)
- Sound like a real indie developer, not a marketing bot
- Pick one theme from the list above
- Include 1-2 relevant hashtags naturally
- Can be: a tip, a milestone, a reflection, a feature highlight, or a dev insight
- No emojis unless they add meaning
- Be authentic and direct

Respond with ONLY this JSON:
{
  "content": "your tweet text here",
  "hashtags": ["tag1", "tag2"]
}`;
}

export async function generateTweet(
  app: AppConfig,
  appKey: string,
  createSession: (opts: any) => HamidSession,
  workspaceDir: string,
): Promise<GeneratedTweet> {
  const prompt = buildContentPrompt(app);

  const session = createSession({
    workingDir: workspaceDir,
    systemPrompt: "You are a tweet writer. Respond only with JSON.",
    onPermissionRequest: async () => ({ behavior: "deny" as const }),
  });

  let resultText = "";
  for await (const event of session.send(prompt)) {
    if (event.type === "text" || event.type === "result") {
      resultText += event.content;
    }
  }

  try {
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      app: appKey,
      content: parsed.content || "",
      hashtags: parsed.hashtags || [],
    };
  } catch {
    return { app: appKey, content: "", hashtags: [] };
  }
}
