import type { ScannedThread } from "./types.js";

interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

interface RedditToken {
  accessToken: string;
  expiresAt: number;
}

const USER_AGENT = "hamid-social:v0.1.0 (by /u/${username})";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";

let cachedToken: RedditToken | null = null;

export async function getAccessToken(
  creds: RedditCredentials,
): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
    "base64",
  );

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT.replace("${username}", creds.username),
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: creds.username,
      password: creds.password,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Reddit auth failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000, // 1min buffer
  };

  return cachedToken.accessToken;
}

export async function searchSubreddit(
  creds: RedditCredentials,
  subreddit: string,
  query: string,
  limit = 25,
): Promise<ScannedThread[]> {
  const token = await getAccessToken(creds);
  const params = new URLSearchParams({
    q: query,
    sort: "new",
    limit: String(limit),
    restrict_sr: "true",
    type: "link",
  });

  const resp = await fetch(
    `${API_BASE}/r/${subreddit}/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT.replace("${username}", creds.username),
      },
    },
  );

  if (!resp.ok) {
    throw new Error(
      `Reddit search failed: ${resp.status} ${await resp.text()}`,
    );
  }

  const data = (await resp.json()) as {
    data: {
      children: Array<{
        data: {
          id: string;
          subreddit: string;
          title: string;
          selftext: string;
          permalink: string;
          author: string;
          ups: number;
          num_comments: number;
          created_utc: number;
        };
      }>;
    };
  };

  return data.data.children.map((child) => ({
    id: `t3_${child.data.id}`,
    subreddit: child.data.subreddit,
    title: child.data.title,
    body: child.data.selftext,
    url: `https://reddit.com${child.data.permalink}`,
    author: child.data.author,
    upvotes: child.data.ups,
    commentCount: child.data.num_comments,
    createdAt: new Date(child.data.created_utc * 1000).toISOString(),
  }));
}

export async function postComment(
  creds: RedditCredentials,
  threadId: string,
  text: string,
): Promise<string> {
  const token = await getAccessToken(creds);

  const resp = await fetch(`${API_BASE}/api/comment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT.replace("${username}", creds.username),
    },
    body: new URLSearchParams({
      thing_id: threadId,
      text,
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Reddit comment failed: ${resp.status} ${await resp.text()}`,
    );
  }

  const data = (await resp.json()) as {
    json: { data: { things: Array<{ data: { id: string } }> } };
  };

  return data.json.data.things[0]?.data.id ?? "unknown";
}

export async function getMyKarma(
  creds: RedditCredentials,
): Promise<{ karma: number; createdUtc: number }> {
  const token = await getAccessToken(creds);

  const resp = await fetch(`${API_BASE}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT.replace("${username}", creds.username),
    },
  });

  if (!resp.ok) {
    throw new Error(
      `Reddit me failed: ${resp.status} ${await resp.text()}`,
    );
  }

  const data = (await resp.json()) as {
    comment_karma: number;
    created_utc: number;
  };

  return { karma: data.comment_karma, createdUtc: data.created_utc };
}
