import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

declare global {
  var _botPrisma: PrismaClient | undefined;
}

function create(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const schema = process.env.DATABASE_SCHEMA || "bot";
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("Invalid DATABASE_SCHEMA");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema }) });
}

/**
 * Lazy singleton: merely importing this module touches no env, so `docker
 * build` (which has no runtime env) can't crash. The client is built on first
 * property access.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    globalThis._botPrisma ??= create();
    const value = Reflect.get(globalThis._botPrisma, prop);
    return typeof value === "function" ? value.bind(globalThis._botPrisma) : value;
  },
});
