// What the bot offers to ordinary members, grouped for the public "What can the bot do?" page. One list for the page and for the
// bot's own test, which checks that every member command is mentioned here (so a new command can't be forgotten) and that
// nothing listed here has been removed. The texts live in the dashboard's message catalogs under "Features".
// Import it from "@aboutselphy/shared/features".

export type FeatureItem = {
  /** Key of the texts: Features.items.<key>.title / .body */
  key: string;
  /** Slash commands to show next to the text, e.g. "/rank" or "/game trivia". Features that work with buttons or by chatting have none. */
  commands: readonly string[];
};

export type FeatureGroup = { id: string; items: readonly FeatureItem[] };

export const FEATURE_GROUPS: readonly FeatureGroup[] = [
  {
    id: "chat",
    items: [
      { key: "levels", commands: ["/rank", "/leaderboard"] },
      { key: "games", commands: ["/game trivia", "/game rps", "/game tictactoe", "/game connect4", "/game hangman", "/game scramble", "/game guess", "/game stats", "/game top"] },
      { key: "starboard", commands: ["/starboard random", "/starboard top"] },
      { key: "counting", commands: [] },
    ],
  },
  {
    id: "join",
    items: [
      { key: "giveaways", commands: [] },
      { key: "polls", commands: [] },
      { key: "suggestions", commands: ["/suggest", "/ideas"] },
    ],
  },
  {
    id: "voice",
    items: [{ key: "voice", commands: ["/voice panel", "/voice name", "/voice limit", "/voice lock"] }],
  },
  {
    id: "help",
    items: [
      { key: "tickets", commands: [] },
      { key: "tags", commands: ["/tag", "/tags"] },
      { key: "help", commands: ["/help"] },
    ],
  },
  {
    id: "personal",
    items: [
      { key: "birthday", commands: ["/birthday set", "/birthday upcoming"] },
      { key: "remind", commands: ["/remind me", "/remind list"] },
      { key: "afk", commands: ["/afk"] },
      { key: "mydata", commands: ["/mydata export", "/mydata delete"] },
    ],
  },
  {
    id: "info",
    items: [
      { key: "lookup", commands: ["/userinfo", "/serverinfo", "/roleinfo", "/avatar"] },
      { key: "invites", commands: ["/invites"] },
    ],
  },
  {
    id: "streams",
    items: [
      { key: "twitch", commands: ["/vip link", "/vip status"] },
      { key: "welcome", commands: [] },
    ],
  },
];

/** The command name of an entry: "/game trivia" -> "game". */
export const commandNameOf = (entry: string): string => entry.replace(/^\//, "").split(" ")[0] ?? "";
