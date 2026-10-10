import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { MAX_COMMAND_NAME, normalizeCommandName } from "@aboutselphy/shared/custom-commands";
import type { Command } from "../../commands/types";
import { onReload } from "../../internal-api/reload";
import { log } from "../../lib/log";
import { countUse, findEnabled, listEnabled } from "./repository";
import { renderCommandText, suggestNames } from "./rules";

// /tag name: the answers staff wrote in the dashboard. Names are cached for the autocomplete list
// (60 s, and dropped when the dashboard changes something); the answer itself is read fresh.

const TTL_MS = 60_000;
let names: { list: string[]; at: number } | undefined;
onReload("customcommands", () => {
  names = undefined;
});

async function cachedNames(): Promise<string[]> {
  if (names && Date.now() - names.at < TTL_MS) return names.list;
  names = { list: (await listEnabled()).map((c) => c.name), at: Date.now() };
  return names.list;
}

const tag: Command = {
  data: new SlashCommandBuilder()
    .setName("tag")
    .setDescription("Show a saved answer, like the rules or an FAQ")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName("name").setDescription("Which answer").setRequired(true).setAutocomplete(true).setMaxLength(MAX_COMMAND_NAME + 8))
    .toJSON(),
  async autocomplete(i) {
    const typed = i.options.getFocused();
    await i.respond(suggestNames(await cachedNames(), typed));
  },
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const found = await findEnabled(normalizeCommandName(i.options.getString("name", true)));
    if (!found) {
      await i.reply({ content: "There is no answer with that name. Try `/tags` for the list.", flags: MessageFlags.Ephemeral });
      return;
    }
    await i.reply({
      content: renderCommandText(found.response, { id: i.user.id, username: i.member.displayName, server: i.guild.name }),
      flags: found.ephemeral ? MessageFlags.Ephemeral : undefined,
      // Only the member who asked can be pinged, whatever staff wrote.
      allowedMentions: { parse: [], users: [i.user.id] },
    });
    await countUse(found.id).catch((err) => log.warn({ err }, "custom commands: could not count a use"));
  },
};

const tags: Command = {
  data: new SlashCommandBuilder().setName("tags").setDescription("List the saved answers you can show with /tag").setContexts(InteractionContextType.Guild).toJSON(),
  async execute(i) {
    const list = await cachedNames();
    await i.reply({
      content: list.length === 0 ? "There are no saved answers yet." : `**Saved answers**\n${list.map((n) => `\`${n}\``).join(", ")}\nShow one with \`/tag name\`.`.slice(0, 2000),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};

export const customCommandCommands: Command[] = [tag, tags];
