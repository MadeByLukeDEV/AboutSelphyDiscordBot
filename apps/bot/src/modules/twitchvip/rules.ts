// Pure part of the Twitch VIP role: who should gain or lose it. Only members whose link staff approved are
// managed; everybody else's roles are left exactly as they are.

export type ApprovedLink = { discordUserId: string; twitchUserId: string };

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
