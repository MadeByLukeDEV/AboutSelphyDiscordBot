/**
 * Read-only sanity check of the configured database: which tables exist in the
 * app schema, the seeded config row, and that the role can't read other apps'
 * schemas. Prints no secrets.
 *
 *   pnpm --filter @aboutselphy/db check
 */
import { config } from "dotenv";
import { Client } from "pg";

config({ path: [".env.local", ".env", "../../.env.local", "../../.env"], quiet: true });

const schema = process.env.DATABASE_SCHEMA || "bot";
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("Invalid DATABASE_SCHEMA");

const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
await client.connect();
try {
  const me = (await client.query("select current_user as u, current_database() as d, current_schema() as s")).rows[0];
  console.log(`connected as ${me.u} to ${me.d}, current schema "${me.s}"`);

  const tables = (
    await client.query("select table_name from information_schema.tables where table_schema = $1 order by 1", [schema])
  ).rows.map((r) => r.table_name);
  console.log(`tables in "${schema}":`, tables.join(", "));

  const cfg = (await client.query(`select id, "nextCaseNumber", "logChannelId", "dmOnAction" from "${schema}"."ModConfig"`)).rows;
  console.log("ModConfig rows:", JSON.stringify(cfg));

  for (const forbidden of ["auth.session", 'main."Profile"']) {
    try {
      await client.query(`select 1 from ${forbidden} limit 1`);
      console.log(`✖ can read ${forbidden} (role is too powerful)`);
    } catch {
      console.log(`✔ cannot read ${forbidden}`);
    }
  }
} finally {
  await client.end();
}
