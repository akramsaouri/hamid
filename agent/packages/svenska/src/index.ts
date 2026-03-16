import "dotenv/config";
import { startServer } from "./server.js";

const config = {
  port: parseInt(process.env.SVENSKA_PORT ?? "3847", 10),
  host: process.env.SVENSKA_HOST ?? "0.0.0.0",
  authToken: process.env.SVENSKA_AUTH_TOKEN ?? "",
  workingDir: process.env.SVENSKA_WORKING_DIR ?? process.cwd(),
  sessionsFile:
    process.env.SVENSKA_SESSIONS_FILE ?? ".svenska-sessions.json",
};

if (!config.authToken) {
  console.error("SVENSKA_AUTH_TOKEN is required in .env");
  process.exit(1);
}

startServer(config);
