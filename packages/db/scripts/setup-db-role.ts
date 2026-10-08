/**
 * Creates the least-privilege Postgres role for the Discord bot + dashboard:
 *
 *   aboutselphy_bot   owns ONLY the schemas "bot" (production) and "bot_dev"
 *                     (local development), so a dev bot never touches
 *                     production data. No CREATEDB, no access to auth/main.
 *
 * Adapted from ../Main/scripts/setup-db-roles.ts. Unlike that script it does
 * NOT touch aboutselphy_auth_reader (Main and Social already use it; rotating
 * it would break them) and does not revoke anything from PUBLIC (already done).
 * The dashboard reads sessions with the existing AUTH_DATABASE_URL.
 *
 * Must run as the postgres superuser: "aboutselphy" can't create roles. The
 * admin URL is never written anywhere by this script.
 *
 *   ADMIN_DATABASE_URL="postgres://postgres:...@host:5435/aboutselphy" \
 *     pnpm --filter @aboutselphy/db setup-role [--dry-run] [--rotate]
 *
 *   --dry-run  print the SQL (password masked) and exit, no changes
 *   --rotate   the role already exists: set a new password instead of failing
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: [".env.local", ".env", "../../.env.local", "../../.env"], quiet: true });

const ROLE = "aboutselphy_bot";
const SCHEMAS = ["bot", "bot_dev"];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const rotate = args.has("--rotate");

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function main() {
  const adminUrlRaw = process.env.ADMIN_DATABASE_URL;
  if (!adminUrlRaw) fail("ADMIN_DATABASE_URL is not set (superuser connection to the aboutselphy database).");
  const adminUrl = new URL(adminUrlRaw);

  const admin = new Client({ connectionString: adminUrlRaw, connectionTimeoutMillis: 10_000 });
  await admin.connect();

  try {
    const { rows: me } = await admin.query<{ user: string; db: string; super: boolean; createrole: boolean }>(
      `SELECT current_user AS user, current_database() AS db, rolsuper AS super, rolcreaterole AS createrole
         FROM pg_roles WHERE rolname = current_user`,
    );
    const who = me[0]!;
    console.log(`Connected as ${who.user} to database "${who.db}".`);
    if (!who.super && !who.createrole && !dryRun) fail(`${who.user} can't create roles. Use the postgres superuser.`);

    const { rowCount } = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [ROLE]);
    const exists = (rowCount ?? 0) > 0;
    if (exists && !rotate) fail(`Role ${ROLE} already exists. Re-run with --rotate to set a new password.`);

    // Plain hex: nothing that needs URL-encoding.
    const password = randomBytes(32).toString("hex");
    const lit = (value: string) => admin.escapeLiteral(value);
    const db = ident(who.db);

    const statements = [
      exists
        ? `ALTER ROLE ${ident(ROLE)} PASSWORD ${lit(password)}`
        : `CREATE ROLE ${ident(ROLE)} LOGIN PASSWORD ${lit(password)}
             NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 20`,
      `GRANT CONNECT ON DATABASE ${db} TO ${ident(ROLE)}`,
      ...SCHEMAS.flatMap((schema) => [
        `CREATE SCHEMA IF NOT EXISTS ${ident(schema)} AUTHORIZATION ${ident(ROLE)}`,
        `ALTER SCHEMA ${ident(schema)} OWNER TO ${ident(ROLE)}`,
      ]),
      `ALTER ROLE ${ident(ROLE)} IN DATABASE ${db} SET search_path = ${ident(SCHEMAS[0]!)}`,
      `ALTER ROLE ${ident(ROLE)} SET idle_in_transaction_session_timeout = '60s'`,
    ];

    console.log("\nPlanned SQL:");
    for (const sql of statements) console.log(`  ${sql.replace(lit(password), "'***'")};`);

    if (dryRun) {
      console.log("\n--dry-run: nothing was changed.");
      return;
    }

    // One transaction: all or nothing.
    await admin.query("BEGIN");
    try {
      for (const sql of statements) await admin.query(sql);
      await admin.query("COMMIT");
    } catch (error) {
      await admin.query("ROLLBACK");
      throw error;
    }
    console.log("\n✔ Applied.");

    const url = new URL(adminUrl.toString());
    url.username = ROLE;
    url.password = password;
    url.search = "";

    await verify(url.toString());

    console.log(
      "\nConnection string (shown once, store it now). The host is the one you connected with; " +
        "in Dokploy use the internal host.\n",
    );
    console.log(`  DATABASE_URL="${url.toString()}"`);
    console.log(`  DATABASE_SCHEMA="bot_dev"   # locally; "bot" in production`);
  } finally {
    await admin.end();
  }
}

async function verify(url: string) {
  const client = new Client({ connectionString: url });
  await client.connect();
  const checks: Array<[string, boolean]> = [];
  try {
    for (const schema of SCHEMAS) {
      const { rows } = await client.query(`SELECT has_schema_privilege($1, 'CREATE') AS c`, [schema]);
      checks.push([`${ROLE}: can create tables in "${schema}"`, rows[0]?.c === true]);
    }
    for (const forbidden of ["auth.session", "main.\"Profile\""]) {
      let denied = false;
      try {
        await client.query(`SELECT 1 FROM ${forbidden} LIMIT 1`);
      } catch {
        denied = true; // permission denied, or the schema doesn't exist: both fine
      }
      checks.push([`${ROLE}: cannot read ${forbidden}`, denied]);
    }
  } finally {
    await client.end();
  }
  console.log("\nVerification:");
  for (const [label, ok] of checks) console.log(`  ${ok ? "✔" : "✖"} ${label}`);
  if (checks.some(([, ok]) => !ok)) fail("Some checks failed -- the role was created, review the output above.");
}

main().catch((error) => {
  console.error("\n✖", error instanceof Error ? error.message : error);
  process.exit(1);
});
