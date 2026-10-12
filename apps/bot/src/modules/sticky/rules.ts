import { EmbedBuilder } from "discord.js";
import { MAX_STICKY_CONTENT, STICKY_COLOR } from "@aboutselphy/shared/sticky";
import { withEmotes } from "../../lib/emotes";
import { truncate } from "../../lib/escape";

// The sticky post. The text is written by staff, so markdown is kept, but the message allows no
// mentions at all: nothing in it can ping anyone. Pure, so the rule is testable.

/** The bot waits this long after the last message before it posts again, so a busy chat isn't chased message by message. */
export const STICKY_DELAY_MS = 3000;

export function buildStickyMessage(content: string) {
  return {
    content: "",
    embeds: [new EmbedBuilder().setColor(STICKY_COLOR).setDescription(truncate(withEmotes(content), MAX_STICKY_CONTENT)).setFooter({ text: "\u{1F4CC} Pinned message" })],
    allowedMentions: { parse: [] as never[] },
  };
}
