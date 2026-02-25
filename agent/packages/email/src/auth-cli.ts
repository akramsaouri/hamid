import { loadCredentials, authorizeAccount } from "./gmail-auth.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(__dirname, "..", "..", "..");

async function main() {
  const accountKey = process.argv[2];
  const accountEmail = process.argv[3];

  if (!accountKey || !accountEmail) {
    console.log("Usage: pnpm --filter @hamid/email auth <account_key> <email>");
    console.log("Example: pnpm --filter @hamid/email auth personal sat@gmail.com");
    process.exit(1);
  }

  const creds = loadCredentials(agentDir);
  const refreshToken = await authorizeAccount(creds, accountEmail);

  const envKey = `GMAIL_REFRESH_TOKEN_${accountKey.toUpperCase()}`;
  console.log(`\nRefresh token obtained for ${accountEmail}`);
  console.log(`Add to agent/.env:\n`);
  console.log(`${envKey}=${refreshToken}`);

  const envPath = resolve(agentDir, ".env");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    if (envContent.includes(envKey)) {
      console.log(`\nNote: ${envKey} already exists in .env. Update it manually.`);
    } else {
      writeFileSync(envPath, envContent.trimEnd() + `\n${envKey}=${refreshToken}\n`);
      console.log(`\nAppended to .env automatically.`);
    }
  }
}

main().catch((err) => {
  console.error("Auth failed:", err.message);
  process.exit(1);
});
