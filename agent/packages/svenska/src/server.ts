import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenarios, getScenariosByCategory } from "./scenarios.js";
import {
  startConversation,
  sendMessage,
  generateSummary,
  endConversation,
} from "./conversation.js";
import { recordSession } from "./accountability.js";
import { createAuthMiddleware } from "./auth.js";
import type { Scenario } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ServerConfig {
  port: number;
  host: string;
  authToken: string;
  workingDir: string;
  sessionsFile: string;
}

export async function startServer(config: ServerConfig) {
  const app = Fastify({ logger: true });

  // Auth
  app.addHook("onRequest", createAuthMiddleware(config.authToken));

  // Serve frontend static files (Vite build output)
  const frontendDir = join(__dirname, "..", "frontend", "dist");
  await app.register(fastifyStatic, {
    root: frontendDir,
    prefix: "/",
    wildcard: false,
  });

  // API routes
  const scenarios = loadScenarios();

  app.get("/api/scenarios", async () => {
    return getScenariosByCategory(scenarios);
  });

  app.post<{ Body: { scenarioId: string } }>(
    "/api/conversation/start",
    async (req, reply) => {
      const scenario = scenarios.find((s) => s.id === req.body.scenarioId);
      if (!scenario) {
        return reply.status(404).send({ error: "Scenario not found" });
      }
      return startConversation(scenario);
    }
  );

  app.post<{ Body: { conversationId: string; message: string } }>(
    "/api/conversation/message",
    async (req, reply) => {
      if (!req.body.message || typeof req.body.message !== "string" || req.body.message.trim() === "") {
        return reply.status(400).send({ error: "Message must be a non-empty string" });
      }
      return sendMessage(
        req.body.conversationId,
        req.body.message,
        config.workingDir
      );
    }
  );

  app.post<{ Body: { conversationId: string } }>(
    "/api/conversation/summary",
    async (req) => {
      const summary = await generateSummary(
        req.body.conversationId,
        config.workingDir
      );
      return summary;
    }
  );

  app.post<{ Body: { conversationId: string; scenarioId: string } }>(
    "/api/conversation/end",
    async (req) => {
      const corrections = endConversation(req.body.conversationId);
      recordSession(req.body.scenarioId, corrections, config.sessionsFile);
      return { ok: true };
    }
  );

  // SPA fallback — serve index.html for non-API, non-file routes
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api/")) {
      reply.status(404).send({ error: "Not found" });
      return;
    }
    return reply.sendFile("index.html");
  });

  await app.listen({ port: config.port, host: config.host });
  console.log(`Svenska med Hamid running on http://${config.host}:${config.port}`);
}
