import { OAuth2Scopes, PermissionFlagsBits as P, PermissionsBitField } from "discord.js";
import { env } from "../src/lib/env";

// Prints the link that adds the bot to the server with the permissions its features need.
// Discord creates the bot's own role ("managed by an integration") from this permission list, so
// the role only exists if the bot was invited with permissions. For a bot that is already in the
// server, open the link again: it updates the role without kicking anything.
// Left out on purpose: Administrator, Mention Everyone (turn on "Allow anyone to @mention" for
// the roles the bot should ping instead).
const permissions = new PermissionsBitField([
  P.ViewChannel,
  P.SendMessages,
  P.SendMessagesInThreads,
  P.EmbedLinks,
  P.AttachFiles,
  P.ReadMessageHistory,
  P.AddReactions,
  P.UseExternalEmojis,
  P.ManageMessages,
  P.ManageChannels,
  P.ManageRoles,
  P.ManageGuild, // reading the server's invites (invite tracking)
  P.KickMembers,
  P.BanMembers,
  P.ModerateMembers,
  P.ViewAuditLog,
  P.Connect,
  P.MoveMembers,
]);

const url = new URL("https://discord.com/oauth2/authorize");
url.searchParams.set("client_id", env().DISCORD_APP_ID);
url.searchParams.set("scope", [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands].join(" "));
url.searchParams.set("permissions", permissions.bitfield.toString());
url.searchParams.set("guild_id", env().DISCORD_GUILD_ID);
url.searchParams.set("disable_guild_select", "true");
console.log(url.toString());
