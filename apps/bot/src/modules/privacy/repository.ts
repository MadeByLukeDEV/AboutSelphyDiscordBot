// Private to the privacy module: only service.ts and commands.ts import this.
import { prisma } from "@aboutselphy/db";
import { clip, type PruneResult } from "./rules";

// -- retention ---------------------------------------------------------------------------------------

export const readRetention = () => prisma.retentionConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const recordRun = (lastResult: string) => prisma.retentionConfig.update({ where: { id: 1 }, data: { lastRunAt: new Date(), lastResult: lastResult.slice(0, 300) } });

export type Cutoffs = { transcript: Date | null; cases: Date | null; suggestions: Date | null; xp: Date | null };

/** Removes what is older than each cutoff (a null cutoff keeps everything of that kind). */
export async function prune(cut: Cutoffs, now: Date): Promise<PruneResult> {
  const result: PruneResult = { transcripts: 0, cases: 0, suggestions: 0, xp: 0 };
  // The dashboard's audit trail keeps names of staff: it is always cleared after a year, even when every other limit is off.
  await prisma.auditEntry.deleteMany({ where: { at: { lt: new Date(now.getTime() - 365 * 86_400_000) } } });
  // Who joined through which invite is kept for a year, then removed, whatever the other limits say.
  await prisma.memberInvite.deleteMany({ where: { joinedAt: { lt: new Date(now.getTime() - 365 * 86_400_000) } } });
  if (cut.transcript) {
    result.transcripts = await prisma.$executeRaw`UPDATE "Ticket" SET "transcript" = NULL WHERE "status" = 'closed' AND "closedAt" < ${cut.transcript} AND "transcript" IS NOT NULL`;
  }
  if (cut.cases) {
    // Never a permanent ban (the record of why they are out) and never a case that still runs.
    result.cases = (
      await prisma.modCase.deleteMany({
        where: { createdAt: { lt: cut.cases }, NOT: { type: "ban", expiresAt: null }, OR: [{ expiresAt: null }, { expiresAt: { lt: now } }] },
      })
    ).count;
  }
  if (cut.suggestions) {
    result.suggestions = (await prisma.suggestion.deleteMany({ where: { status: { not: "open" }, decidedAt: { lt: cut.suggestions } } })).count; // votes go with them (cascade)
  }
  if (cut.xp) {
    result.xp = (await prisma.memberXp.deleteMany({ where: { updatedAt: { lt: cut.xp } } })).count;
  }
  return result;
}

/** Hides the member from (or shows them on) the public leaderboard page. False when they have no XP row. */
export async function setLeaderboardHidden(userId: string, hidden: boolean): Promise<boolean> {
  return (await prisma.memberXp.updateMany({ where: { userId }, data: { hidden } })).count > 0;
}

// -- one member's data -------------------------------------------------------------------------------

/** Everything the bot holds about one member, shaped for a JSON file they can read. Moderators' names are left out. */
export async function exportMember(userId: string) {
  const [birthday, reminders, xp, snapshot, suggestions, suggestionVotes, pollVotes, giveawayEntries, tickets, starboard, vip, cases, room, joins, invited] = await Promise.all([
    prisma.birthday.findUnique({ where: { userId } }),
    prisma.reminder.findMany({ where: { userId, deliveredAt: null }, take: 100 }),
    prisma.memberXp.findUnique({ where: { userId } }),
    prisma.memberRoleSnapshot.findUnique({ where: { userId } }),
    prisma.suggestion.findMany({ where: { authorId: userId }, take: 200 }),
    prisma.suggestionVote.count({ where: { userId } }),
    prisma.pollVote.count({ where: { userId } }),
    prisma.giveawayEntry.count({ where: { userId } }),
    prisma.ticket.findMany({ where: { openerId: userId }, take: 200 }),
    prisma.starboardPost.count({ where: { authorId: userId } }),
    prisma.twitchVipLink.findUnique({ where: { discordUserId: userId } }),
    prisma.modCase.findMany({ where: { targetId: userId }, orderBy: { caseNumber: "asc" }, take: 500 }),
    prisma.tempVoicePreference.findUnique({ where: { userId } }),
    prisma.memberInvite.findMany({ where: { userId }, orderBy: { joinedAt: "desc" }, take: 20 }),
    prisma.memberInvite.count({ where: { inviterId: userId } }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    discordUserId: userId,
    note: "Everything the bot stores about you. Moderator names are left out. Message content is not stored, except in tickets you opened.",
    birthday: birthday ? { month: birthday.month, day: birthday.day, year: birthday.year } : null,
    pendingReminders: reminders.map((r) => ({ remindAt: r.remindAt.toISOString(), message: clip(r.message) })),
    levels: xp ? { xp: xp.xp, messages: xp.messages, voiceMinutes: xp.voiceMinutes, hiddenFromPublicPage: xp.hidden } : null,
    rememberedRoles: snapshot ? { roleIds: snapshot.roleIds, savedAt: snapshot.savedAt.toISOString() } : null,
    suggestions: suggestions.map((s) => ({ number: s.number, text: clip(s.content, 1500), status: s.status, createdAt: s.createdAt.toISOString() })),
    counts: { suggestionVotes, pollVotes, giveawayEntries, starboardPosts: starboard },
    tickets: tickets.map((t) => ({ number: t.number, status: t.status, openedAt: t.createdAt.toISOString(), closedAt: t.closedAt?.toISOString() ?? null, messagesSaved: t.messageCount })),
    howYouJoined: joins.map((j) => ({ joinedAt: j.joinedAt.toISOString(), left: j.leftAt?.toISOString() ?? null, via: j.source, inviteCode: j.code, invitedBy: j.inviterName })),
    peopleYouInvited: invited,
    rememberedVoiceRoom: room ? { name: room.name, userLimit: room.userLimit, locked: room.locked } : null,
    twitchVipLink: vip ? { twitchAccount: vip.twitchLogin, confirmed: vip.approved } : null,
    moderationCases: cases.map((c) => ({ caseNumber: c.caseNumber, type: c.type, reason: clip(c.reason, 1000), createdAt: c.createdAt.toISOString(), active: c.active })),
  };
}

export type DeleteCounts = { invites: number; voiceRoom: number; birthday: number; reminders: number; levels: number; rememberedRoles: number; votes: number; entries: number; suggestionsAnonymised: number; starboardAnonymised: number };

/**
 * Removes what the member can remove themselves, in one transaction. Moderation cases and tickets stay (the policy says
 * why: they protect others and answer appeals); suggestions and starboard posts stay without the author's name, because
 * other people's votes and comments hang off them. The Twitch link is handled by the caller (the role must come off first).
 */
export async function deleteMember(userId: string): Promise<DeleteCounts> {
  const [inv, voice, birthday, reminders, levels, snapshot, sv, pv, entries, suggestions, starboard] = await prisma.$transaction([
    // Their own join record goes; where they are the inviter, the person who joined stays on record without a name for the inviter.
    prisma.memberInvite.deleteMany({ where: { userId } }),
    prisma.tempVoicePreference.deleteMany({ where: { userId } }),
    prisma.birthday.deleteMany({ where: { userId } }),
    prisma.reminder.deleteMany({ where: { userId } }),
    prisma.memberXp.deleteMany({ where: { userId } }),
    prisma.memberRoleSnapshot.deleteMany({ where: { userId } }),
    prisma.suggestionVote.deleteMany({ where: { userId } }),
    prisma.pollVote.deleteMany({ where: { userId } }),
    prisma.giveawayEntry.deleteMany({ where: { userId } }),
    prisma.suggestion.updateMany({ where: { authorId: userId }, data: { authorName: "deleted user" } }),
    prisma.starboardPost.updateMany({ where: { authorId: userId }, data: { authorName: "deleted user" } }),
  ]);
  await prisma.memberInvite.updateMany({ where: { inviterId: userId }, data: { inviterId: null, inviterName: null } });
  return { invites: inv.count, voiceRoom: voice.count, birthday: birthday.count, reminders: reminders.count, levels: levels.count, rememberedRoles: snapshot.count, votes: sv.count + pv.count, entries: entries.count, suggestionsAnonymised: suggestions.count, starboardAnonymised: starboard.count };
}

