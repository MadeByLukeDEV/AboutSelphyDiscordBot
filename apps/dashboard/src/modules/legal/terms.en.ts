import type { LegalDoc, Operator } from "./types";

export function termsEn(o: Operator): LegalDoc {
  return {
    title: "Terms of Service",
    intro: "These terms apply to your use of the AboutSelphy Discord bot and its features. By using the bot, its commands or its buttons you agree to them. If you don't agree, please don't use the bot.",
    sections: [
      {
        id: "scope",
        heading: "1. Who these terms are between",
        blocks: [
          `The bot is run by ${o.name} (the operator, see the contact details below) for the AboutSelphy Discord server. It only works in that server. These terms are in addition to Discord's Terms of Service and Community Guidelines, which you must follow as well.`,
        ],
      },
      {
        id: "service",
        heading: "2. What the bot offers",
        blocks: [
          "The bot offers community features such as moderation tools, logs, levels and ranks, tickets, giveaways, polls, suggestions, role panels, birthdays, reminders, a counting channel, custom commands, auto-responders, temporary voice rooms, announcements and a staff dashboard. Which features are on can differ and can change.",
          "The bot is a free community service run in spare time. It is provided \"as is\". Features can change, break, pause or be removed at any time, with or without notice.",
        ],
      },
      {
        id: "conduct",
        heading: "3. How to use it",
        blocks: [
          "You agree not to:",
          {
            list: [
              "misuse the bot to spam, harass, threaten or deceive others, or to break Discord's rules or the law;",
              "try to get around limits, cooldowns, permissions or moderation, or to find and use bugs for an unfair advantage (please report them instead);",
              "use scripts or other tools to operate the bot's commands or buttons automatically;",
              "put other people's personal data, illegal content or content you have no right to share into the bot (for example into a suggestion, a ticket or a reminder);",
              "try to access the dashboard, the bot's internal interfaces or the data of others without permission.",
            ],
          },
        ],
      },
      {
        id: "content",
        heading: "4. What you send to the bot",
        blocks: ["You are responsible for the text and files you send through the bot. By sending them you allow the bot and the server's staff to process, store and show them as needed for the feature you used (for example to show your suggestion in the suggestions channel). Your rights to your own content stay with you."],
      },
      {
        id: "moderation",
        heading: "5. Moderation",
        blocks: ["Staff can warn, mute, time out, kick or ban you, delete content and remove access to features if you break these terms or the server rules. Such actions are recorded. If you think a decision was wrong, you can ask staff or contact the operator to look at it again."],
      },
      {
        id: "privacy",
        heading: "6. Your data",
        blocks: ["How the bot handles personal data is described in the Privacy Policy. Some features are optional (for example birthdays and reminders) and only store data when you use them."],
      },
      {
        id: "third",
        heading: "7. Other services",
        blocks: ["The bot works with Discord and can show links or public information from services such as Twitch, YouTube or TikTok. Those services have their own terms and the operator is not responsible for them or for their content."],
      },
      {
        id: "staff",
        heading: "8. For staff using the dashboard",
        blocks: ["Staff must treat the data they see in the dashboard as confidential, use it only for moderating and running the community, and not share or copy it elsewhere. Access can be withdrawn at any time. Actions in the dashboard are attributed to the person who did them."],
      },
      {
        id: "liability",
        heading: "9. Liability",
        blocks: [
          "To the extent the law allows, the operator is not liable for damage caused by the use of or the unavailability of the bot, lost data, or the actions of other users. This does not limit liability for intent or gross negligence, for injury to life, body or health, or where the law makes liability mandatory.",
        ],
      },
      {
        id: "end",
        heading: "10. Ending your use",
        blocks: ["You can stop using the bot at any time, for example by leaving the server. The operator can end or restrict your access, in particular if you break these terms. Sections that by their nature should continue (such as moderation records and liability) stay in force."],
      },
      {
        id: "changes",
        heading: "11. Changes to these terms",
        blocks: ["These terms can change, for example when features or the law change. The date at the top shows the current version. If you keep using the bot after a change, you accept the new version. Important changes will be announced in the server."],
      },
      {
        id: "law",
        heading: "12. Governing law",
        blocks: [`The law of ${o.country} applies, without taking away the mandatory consumer protection rules of the country you live in.`],
      },
      {
        id: "contact",
        heading: "13. Contact",
        blocks: [`${o.name}, ${o.address}, ${o.email}`],
      },
    ],
  };
}
