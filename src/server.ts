// Minimal Fastify server: two routes. /health for probes (same pattern
// as documind-backend), and /diagnose (the actual agent endpoint).
// No auth, no public Ingress: this service is internal-only

import Fastify from "fastify";
import { env } from "./config/env.js";
import { diagnose } from "./routes/diagnose.js";

const fastify = Fastify({ logger: true });

fastify.get("/health", async (_req, reply) => {
  return reply.code(200).send({ status: "ok" });
});

fastify.post("/diagnose", async (req, reply) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const question =
    typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    return reply.code(400).send({ message: "question is required" });
  }

  try {
    const answer = await diagnose(question);
    return reply.send({ answer });
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ message: "Diagnosis failed" });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`DocuMind agent running on http://0.0.0.0:${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
