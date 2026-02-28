import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { createServer } from "node:http";
import { URL } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

const REDIRECT_PORT = 3847;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
}

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiry: number;
}

export function loadCredentials(agentDir: string): GmailCredentials {
  const credPath = resolve(agentDir, "config", "gmail-credentials.json");
  if (!existsSync(credPath)) {
    throw new Error(
      `Gmail credentials not found at ${credPath}. ` +
        "Download OAuth2 client credentials from Google Cloud Console " +
        "and save as agent/config/gmail-credentials.json"
    );
  }
  const raw = JSON.parse(readFileSync(credPath, "utf-8"));
  const creds = raw.installed || raw.web;
  if (!creds?.client_id || !creds?.client_secret) {
    throw new Error(
      `Invalid credentials file at ${credPath}. ` +
      "Expected OAuth2 client credentials with 'installed' or 'web' key."
    );
  }
  return {
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
  };
}

export function createOAuth2Client(creds: GmailCredentials): OAuth2Client {
  return new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    REDIRECT_URI
  );
}

export async function authorizeAccount(
  creds: GmailCredentials,
  accountEmail: string
): Promise<string> {
  const oauth2 = createOAuth2Client(creds);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    login_hint: accountEmail,
  });

  console.log(`\nAuthorize ${accountEmail}:`);
  console.log(authUrl);
  console.log("\nWaiting for callback...\n");

  execFile("open", [authUrl], () => {});

  const code = await waitForCallback();

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token received. Revoke access at https://myaccount.google.com/permissions and try again."
    );
  }

  return tokens.refresh_token;
}

function waitForCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end(`Authorization failed: ${error}`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h1>Authorization successful</h1><p>You can close this tab.</p>"
        );
        server.close();
        resolve(code);
        return;
      }

      if (!code && !error) {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(
        `Listening for OAuth callback on port ${REDIRECT_PORT}...`
      );
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Authorization timed out after 2 minutes"));
    }, 120_000);
  });
}

export function getAuthenticatedClient(
  creds: GmailCredentials,
  refreshToken: string
): OAuth2Client {
  const oauth2 = createOAuth2Client(creds);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}
