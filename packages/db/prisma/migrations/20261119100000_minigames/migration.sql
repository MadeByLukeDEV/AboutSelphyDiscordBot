CREATE TABLE "GameConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "winXp" INTEGER NOT NULL DEFAULT 20,
    "dailyXpCap" INTEGER NOT NULL DEFAULT 200,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 10,
    "allowedChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triviaOn" BOOLEAN NOT NULL DEFAULT true,
    "rpsOn" BOOLEAN NOT NULL DEFAULT true,
    "tictactoeOn" BOOLEAN NOT NULL DEFAULT true,
    "connect4On" BOOLEAN NOT NULL DEFAULT true,
    "funOn" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "GameConfig" ADD CONSTRAINT "GameConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "GameConfig" ADD CONSTRAINT "GameConfig_ranges" CHECK ("winXp" BETWEEN 0 AND 100 AND "dailyXpCap" BETWEEN 0 AND 5000 AND "cooldownSeconds" BETWEEN 0 AND 600 AND cardinality("allowedChannelIds") <= 20);

CREATE TABLE "GameStat" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(20) NOT NULL,
    "game" VARCHAR(12) NOT NULL,
    "name" VARCHAR(100) NOT NULL DEFAULT '',
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GameStat_userId_game_key" ON "GameStat"("userId", "game");
CREATE INDEX "GameStat_game_wins_idx" ON "GameStat"("game", "wins");
ALTER TABLE "GameStat" ADD CONSTRAINT "GameStat_counts" CHECK ("played" >= 0 AND "wins" >= 0 AND "draws" >= 0 AND "wins" + "draws" <= "played");

CREATE TABLE "GameXpDay" (
    "userId" VARCHAR(20) NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GameXpDay_pkey" PRIMARY KEY ("userId", "day")
);
