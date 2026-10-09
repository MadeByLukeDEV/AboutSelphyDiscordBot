import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@aboutselphy/db";
import { countCasesByType, createCase, findCaseByNumber, listCasesForTarget, readConfig, setCaseLogMessage } from "./repository";

// Real-database tests. They write cases (and advance the case counter), so they
// only run when INTEGRATION_DB=1 and NEVER against the production schema "bot".
// Run against a throwaway database, e.g. the Docker Postgres from CLAUDE.md:
//   INTEGRATION_DB=1 DATABASE_URL=... DATABASE_SCHEMA=bot_dev pnpm --filter @aboutselphy/bot test
const enabled = process.env.INTEGRATION_DB === "1" && (process.env.DATABASE_SCHEMA ?? "bot") !== "bot";

const TARGET = "700000000000000001";
const MOD = "700000000000000002";
const created: string[] = [];

describe.skipIf(!enabled)("moderation repository (real database)", () => {
  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await prisma.modCase.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  const base = {
    type: "warn" as const,
    source: "command" as const,
    targetId: TARGET,
    targetName: "Target",
    moderatorId: MOD,
    moderatorName: "Mod",
    reason: "test",
  };

  it("has the seeded singleton config", async () => {
    const config = await readConfig();
    expect(config.id).toBe(1);
    expect(config.nextCaseNumber).toBeGreaterThanOrEqual(1);
    expect(config.dmOnAction).toBe(true);
  });

  it("numbers cases sequentially and never reuses a number, even in parallel", async () => {
    const before = (await readConfig()).nextCaseNumber;
    const rows = await Promise.all(Array.from({ length: 25 }, () => createCase(base)));
    created.push(...rows.map((r) => r.id));

    const numbers = rows.map((r) => r.caseNumber).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(25);
    expect(numbers[0]).toBe(before);
    expect(numbers[24]).toBe(before + 24);
    expect((await readConfig()).nextCaseNumber).toBe(before + 25);
  });

  it("stores timeouts with duration and expiry, and finds cases back", async () => {
    const expiresAt = new Date(Date.now() + 3600_000);
    const row = await createCase({ ...base, type: "timeout", durationSeconds: 3600, expiresAt });
    created.push(row.id);

    const found = await findCaseByNumber(row.caseNumber);
    expect(found).toMatchObject({ type: "timeout", durationSeconds: 3600, active: true });
    expect(found?.expiresAt?.getTime()).toBe(expiresAt.getTime());

    const list = await listCasesForTarget(TARGET, 5);
    expect(list[0]?.id).toBe(row.id); // newest first
  });

  it("counts cases by type", async () => {
    const counts = await countCasesByType(TARGET);
    const warns = counts.filter((c) => c.type === "warn").reduce((n, c) => n + c.count, 0);
    expect(warns).toBeGreaterThanOrEqual(25);
  });

  it("remembers where the log embed was posted", async () => {
    const row = await createCase(base);
    created.push(row.id);
    const updated = await setCaseLogMessage(row.id, "700000000000000003", "700000000000000004");
    expect(updated).toMatchObject({ logChannelId: "700000000000000003", logMessageId: "700000000000000004" });
  });

  it("accepts 'system' as moderator for automatic rules", async () => {
    const row = await createCase({ ...base, type: "antibot", source: "automod", moderatorId: "system", moderatorName: null });
    created.push(row.id);
    expect(row.moderatorId).toBe("system");
  });

  describe("database CHECK constraints", () => {
    it("rejects non-numeric Discord IDs", async () => {
      await expect(createCase({ ...base, targetId: "not-an-id" })).rejects.toThrow();
      await expect(createCase({ ...base, moderatorId: "someone" })).rejects.toThrow();
    });

    it("rejects a non-positive duration", async () => {
      await expect(createCase({ ...base, type: "timeout", durationSeconds: 0 })).rejects.toThrow();
    });

    it("does not leak a case number when an insert fails", async () => {
      // The counter increment and the insert share a transaction: a failed
      // insert rolls the increment back.
      const before = (await readConfig()).nextCaseNumber;
      await expect(createCase({ ...base, targetId: "bad" })).rejects.toThrow();
      expect((await readConfig()).nextCaseNumber).toBe(before);
    });

    it("keeps ModConfig a singleton", async () => {
      await expect(prisma.modConfig.create({ data: { id: 2 } })).rejects.toThrow();
    });
  });
});
