// Run before starting an app: generates the Prisma client only when it is
// missing (fresh clone, or wiped by a branch switch), so normal starts stay fast.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const client = fileURLToPath(new URL("../src/generated/prisma/client.ts", import.meta.url));
if (existsSync(client)) process.exit(0);

console.log("Prisma client missing, generating it...");
const result = spawnSync("node", [fileURLToPath(new URL("./generate.mjs", import.meta.url))], { stdio: "inherit" });
process.exit(result.status ?? 1);
