// Pure part of the Twitch VIP role: who should gain or lose it. Only members whose link staff approved are
// managed; everybody else's roles are left exactly as they are.

export type ApprovedLink = { discordUserId: string; twitchUserId: string };

export type ExistingLink = { id: string; discordUserId: string; approved: boolean };

export type VerifiedLinkPlan = { action: "link"; remove: string[] } | { action: "taken" };

/**
 * A verified link (Discord checked the Twitch connection) comes in. `holder` is whoever already has this Twitch account,
 * `own` is this member's existing link. A confirmed link of someone else keeps the account (staff must sort that out);
 * a mere pending claim of someone else loses to proof; the member's own older link is replaced.
 */
export function planVerifiedLink(discordUserId: string, holder: ExistingLink | null, own: ExistingLink | null): VerifiedLinkPlan {
  const remove: string[] = [];
  if (holder && holder.discordUserId !== discordUserId) {
    if (holder.approved) return { action: "taken" };
    remove.push(holder.id);
  }
  if (own && !remove.includes(own.id)) remove.push(own.id);
  return { action: "link", remove };
}

export type VipPlan = { give: string[]; take: string[] };

/**
 * `vipIds`: Twitch user ids that are VIP right now. `holders`: Discord ids that wear the role right now
 * (only the linked ones matter). A linked member gets the role when their Twitch account is a VIP and loses
 * it when it no longer is.
 */
export function planVipRoles(links: readonly ApprovedLink[], vipIds: ReadonlySet<string>, holders: ReadonlySet<string>): VipPlan {
  const plan: VipPlan = { give: [], take: [] };
  for (const link of links) {
    const isVip = vipIds.has(link.twitchUserId);
    const has = holders.has(link.discordUserId);
    if (isVip && !has) plan.give.push(link.discordUserId);
    else if (!isVip && has) plan.take.push(link.discordUserId);
  }
  return plan;
}
