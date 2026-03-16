import type { SocialState } from "./types.js";
import { approveDraft, skipDraft } from "./queue.js";
import { postDraft } from "./poster.js";
import { saveState } from "./state.js";

interface CallbackResult {
  responseText: string;
  success: boolean;
}

export async function handleSocialCallback(
  callbackData: string,
  state: SocialState,
  agentDir: string,
  credentials: {
    reddit: { clientId: string; clientSecret: string; username: string; password: string };
    twitter: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string };
  },
): Promise<CallbackResult> {
  const parts = callbackData.split(":");
  // Format: social:approve:<draftId> or social:skip:<draftId>
  const action = parts[1];
  const draftId = parts[2];

  if (!draftId) {
    return { responseText: "Invalid callback data", success: false };
  }

  if (action === "skip") {
    skipDraft(state, draftId);
    saveState(agentDir, state);
    return { responseText: "Skipped.", success: true };
  }

  if (action === "approve") {
    const draft = approveDraft(state, draftId);
    if (!draft) {
      return { responseText: "Draft not found or already processed.", success: false };
    }

    try {
      const postId = await postDraft(draft, state, credentials);
      saveState(agentDir, state);

      const platform = draft.platform === "reddit" ? "Reddit" : "X";
      return {
        responseText: `Posted to ${platform}. (ID: ${postId})`,
        success: true,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Revert approval on failure
      draft.status = "pending";
      state.stats.totalApproved--;
      saveState(agentDir, state);
      return { responseText: `Post failed: ${msg}`, success: false };
    }
  }

  return { responseText: "Unknown action", success: false };
}
