import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

function createPrismaClient() {
  const accelerateUrl = process.env.PRISMA_ACCELERATE_DATABASE_URL;

  if (!accelerateUrl) {
    throw new Error('PRISMA_ACCELERATE_DATABASE_URL is not set');
  }

  return new PrismaClient({ accelerateUrl }).$extends(withAccelerate());
}

let client: ReturnType<typeof createPrismaClient> | undefined;

/**
 * The Prisma Accelerate client behind transcript search. Prisma 7 validates
 * the connection URL in the constructor, so the client is built on first use:
 * building it at import time would throw from every module that pulls in the
 * router whenever the (optional) URL is unset, not just from this endpoint.
 */
export function getPrisma() {
  client ??= createPrismaClient();
  return client;
}
