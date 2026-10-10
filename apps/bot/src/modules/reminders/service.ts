import { Events, type Client, type Guild } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { claimDelivery, forgetUser, listDue, pruneDelivered } from "./repository";
import { reminderText } from "./rules";

// Delivers reminders. A round every 30 s; each reminder is claimed with one conditional UPDATE
// (delivered once), then sent as a DM, or in the channel where it was set if the DMs are closed.
// After a restart overdue reminders are delivered with a note. Works even when the feature was
// switched off after they were set: the switch only stops new ones.

const INTERVAL_MS = 30_000;
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

export async function deliverDue(guild: Guild): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    for (const r of await listDue(now)) {
      if (!(await claimDelivery(r.id))) continue;
      const text = reminderText(r, now);
      const user = await guild.client.users.fetch(r.userId).catch(() => null);
      const dmed = user ? await user.send({ content: text, allowedMentions: { users: [r.userId] } }).then(() => true, () => false) : false;
      if (dmed) {
        log.info({ reminder: r.id }, "reminder delivered by DM");
        continue;
      }
      const channel = await guild.channels.fetch(r.channelId).catch(() => null);
      if (channel?.isTextBased() && "send" in channel) {
        await channel
          .send({ content: text, allowedMentions: { parse: [], users: [r.userId] } })
          .then(() => log.info({ reminder: r.id }, "reminder delivered in the channel (DMs closed)"))
          .catch((err) => log.warn({ err, reminder: r.id }, "reminder could not be delivered"));
      } else {
        log.warn({ reminder: r.id }, "reminder could not be delivered (DMs closed, channel gone)");
      }
    }
    await pruneDelivered(new Date(now.getTime() - 86_400_000));
  } catch (err) {
    log.error({ err }, "reminder round failed");
  } finally {
    running = false;
  }
}

/** Starts delivery with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it messages real members). */
export function startReminders(client: Client): void {
  // A member who leaves takes their reminders with them (personal data).
  client.on(Events.GuildMemberRemove, (member) => {
    if (member.guild.id !== env().DISCORD_GUILD_ID) return;
    void forgetUser(member.id).catch((err) => log.warn({ err }, "reminders: could not forget a member who left"));
  });
  if (!integrationsActive()) {
    log.info({}, "reminders: not delivering (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.once(Events.ClientReady, () => {
    const run = () => {
      const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
      if (guild) void deliverDue(guild);
    };
    run();
    timer = setInterval(run, INTERVAL_MS);
  });
}

export function stopReminders(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
