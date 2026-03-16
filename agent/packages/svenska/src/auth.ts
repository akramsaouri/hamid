import type { FastifyRequest, FastifyReply } from "fastify";

export function createAuthMiddleware(token: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for static files
    if (!req.url.startsWith("/api/")) return;

    const query = req.query as Record<string, string>;
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const queryToken = query.token;

    if (headerToken !== token && queryToken !== token) {
      reply.status(401).send({ error: "Unauthorized" });
    }
  };
}
