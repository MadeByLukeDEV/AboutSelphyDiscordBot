import { MessageFlags } from "discord.js";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { log } from "../../lib/log";
import { getReminderConfig } from "./config";
import { claimSnooze, createReminder, findReminder, pendingCount } from "./repository";
import { parseSnooze, snoozeLabel } from "./rules";

/**
 * The snooze buttons on a delivered reminder (in a DM or in the channel). Nothing is trusted from the interaction: the id is
 * parsed strictly, only the reminder's owner can use it, once, and a snooze is a new reminder for the same words, counted
 * against the member's limit like any other. It also works from a DM, where the interaction has no server.
 */
async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.isButton()) return;
  const parsed = parseSnooze(i.customId);
  if (!parsed) return void (await i.reply({ content: "That button isn't valid any more.", flags: MessageFlags.Ephemeral }));

  const original = await findReminder(parsed.id);
  if (!original || original.userId !== i.user.id) return void (await i.reply({ content: "This reminder isn't yours.", flags: MessageFlags.Ephemeral }));
  const config = await getReminderConfig();
  if (!config.enabled) return void (await i.reply({ content: "Reminders are switched off.", flags: MessageFlags.Ephemeral }));
  if ((await pendingCount(i.user.id)) >= config.maxPerUser) return void (await i.reply({ content: `You already have ${config.maxPerUser} pending reminders. Cancel one with \`/remind cancel\` first.`, flags: MessageFlags.Ephemeral }));
  if (!(await claimSnooze(parsed.id, i.user.id))) return void (await i.reply({ content: "This reminder was already snoozed.", flags: MessageFlags.Ephemeral }));

  const remindAt = new Date(Date.now() + parsed.minutes * 60_000);
  await createReminder({ userId: i.user.id, channelId: original.channelId, message: original.message, remindAt, delivery: original.delivery === "channel" ? "channel" : "dm" });
  log.info({ reminder: parsed.id, minutes: parsed.minutes }, "reminder snoozed");
  // The buttons go away; the reminder text stays.
  await i.update({ components: [] });
  await i.followUp({ content: `Snoozed for ${snoozeLabel(parsed.minutes)}: I'll remind you <t:${Math.floor(remindAt.getTime() / 1000)}:R>.`, flags: MessageFlags.Ephemeral });
}

export function registerReminderControls(): void {
  onComponent("rm", async (i) => {
    try {
      await handle(i);
    } catch (err) {
      log.error({ err, user: i.user.id }, "reminder interaction failed");
      throw err; // the router answers the member with a generic message
    }
  });
}
