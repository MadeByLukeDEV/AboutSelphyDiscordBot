-- AlterTable
ALTER TABLE "YoutubeConfig" ADD COLUMN "showWatchButton" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "YoutubeConfig" ADD COLUMN "announcePremieres" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "YoutubeConfig" ADD COLUMN "premiereTemplate" VARCHAR(300) NOT NULL DEFAULT 'Premiere {time}: {title}';
