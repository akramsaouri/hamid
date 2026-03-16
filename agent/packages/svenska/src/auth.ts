import type { FastifyRequest, FastifyReply } from "fastify";

export function createAuthMiddleware(token: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith("/api/")) return;

    const headerToken = req.headers.authorization?.replace("Bearer ", "");

    if (headerToken !== token) {
      reply.status(401).send({ error: "Unauthorized" });
    }
  };
}
