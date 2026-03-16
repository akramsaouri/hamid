import type { QueuedDraft, SocialState } from "./types.js";
import { postComment } from "./reddit.js";
import { postTweet } from "./twitter.js";
import { markPosted } from "./queue.js";

interface PostCredentials {
  reddit: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
  };
  twitter: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  };
}

export async function postDraft(
  draft: QueuedDraft,
  state: SocialState,
  creds: PostCredentials,
): Promise<string> {
  let postId: string;

  if (draft.platform === "reddit") {
    postId = await postComment(creds.reddit, draft.threadId, draft.draft);
  } else if (draft.platform === "twitter") {
    postId = await postTweet(creds.twitter, draft.draft);
  } else {
    throw new Error(`Unknown platform: ${draft.platform}`);
  }

  markPosted(state, draft.id, postId);
  return postId;
}
