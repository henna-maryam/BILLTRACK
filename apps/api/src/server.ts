import cors from "@fastify/cors";
import Fastify from "fastify";
import { shopRegistrationSchema } from "./validation";

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
  credentials: true,
});

server.get("/health", async () => ({
  ok: true,
  service: "billtrack-api",
}));

server.post("/registration-requests", async (request, reply) => {
  const result = shopRegistrationSchema.safeParse(request.body);

  if (!result.success) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      issues: result.error.flatten(),
    });
  }

  return reply.status(202).send({
    status: "PENDING_APPROVAL",
    request: result.data,
  });
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ port, host });
