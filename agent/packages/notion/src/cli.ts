import { config } from "dotenv";
import { join } from "node:path";
import { createPage, createDatabasePage, appendBlocks } from "./notion.js";

const agentDir = new URL("../../..", import.meta.url).pathname;
config({ path: join(agentDir, ".env") });

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN must be set in agent/.env");
  process.exit(1);
}

const command = process.argv[2];
if (!command) {
  console.error(
    "Usage: notion <create-page|create-db-page|append> < input.json",
  );
  process.exit(1);
}

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk as Buffer);
}
const input = JSON.parse(Buffer.concat(chunks).toString());

switch (command) {
  case "create-page": {
    const result = await createPage(token, input);
    console.log(JSON.stringify({ id: result.id, url: result.url }));
    break;
  }
  case "create-db-page": {
    const result = await createDatabasePage(token, input);
    console.log(JSON.stringify({ id: result.id, url: result.url }));
    break;
  }
  case "append": {
    const result = await appendBlocks(token, input);
    console.log(JSON.stringify({ ok: true }));
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
