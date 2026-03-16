import { createHmac, randomBytes } from "node:crypto";

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

const API_BASE = "https://api.twitter.com";

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function generateOAuthHeader(
  method: string,
  url: string,
  creds: TwitterCredentials,
  body?: Record<string, string>,
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...(body || {}) };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const baseString = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(creds.apiSecret)}&${percentEncode(creds.accessTokenSecret)}`;

  const signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  oauthParams.oauth_signature = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

export async function postTweet(
  creds: TwitterCredentials,
  text: string,
): Promise<string> {
  const url = `${API_BASE}/2/tweets`;
  const authorization = generateOAuthHeader("POST", url, creds);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!resp.ok) {
    throw new Error(`X post failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as { data: { id: string } };
  return data.data.id;
}

export async function getMyProfile(
  creds: TwitterCredentials,
): Promise<{ username: string; followers: number }> {
  const url = `${API_BASE}/2/users/me?user.fields=public_metrics`;
  const authorization = generateOAuthHeader("GET", url, creds);

  const resp = await fetch(url, {
    headers: { Authorization: authorization },
  });

  if (!resp.ok) {
    throw new Error(`X profile failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as {
    data: {
      username: string;
      public_metrics: { followers_count: number };
    };
  };

  return {
    username: data.data.username,
    followers: data.data.public_metrics.followers_count,
  };
}
