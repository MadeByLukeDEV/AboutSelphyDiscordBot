// Regenerates the Prisma client from scratch. The client lives in
// src/generated (gitignored). Switching git branches can leave a half-deleted
// folder there, and `prisma generate` then refuses with "exists and is not
// empty but doesn't look like a generated Prisma Client". So remove it first.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
rmSync(new URL("../src/generated", import.meta.url), { recursive: true, force: true });

const result = spawnSync("pnpm", ["exec", "prisma", "generate"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
