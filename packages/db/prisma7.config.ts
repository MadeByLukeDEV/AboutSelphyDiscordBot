// Loads .env.local then .env (same precedence as Next.js), looking in this
// package first and then the repo root, so the CLI and the apps see the same
// DATABASE_URL.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: [".env.local", ".env", "../../.env.local", "../../.env"], quiet: true });

// DATABASE_URL stays a plain connection string; the running apps pass the
// schema to the pg adapter. The CLI needs it as ?schema= so migrations land in
// this app's schema ("bot", or "bot_dev" locally), never in "public".
function withSchema(url: string | undefined): string | undefined {
  if (!url) return url;
  const parsed = new URL(url);
  if (!parsed.searchParams.has("schema")) {
    parsed.searchParams.set("schema", process.env.DATABASE_SCHEMA || "bot");
  }
  return parsed.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: withSchema(process.env["DATABASE_URL"]) },
});
