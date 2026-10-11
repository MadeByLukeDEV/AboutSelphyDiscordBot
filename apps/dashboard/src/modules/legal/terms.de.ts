import type { LegalDoc, Operator } from "./types";

export function termsDe(o: Operator): LegalDoc {
  return {
    title: "Nutzungsbedingungen",
    intro: "Diese Bedingungen gelten für deine Nutzung des AboutSelphy-Discord-Bots und seiner Funktionen. Mit der Nutzung des Bots, seiner Befehle oder Buttons stimmst du ihnen zu. Wenn du nicht einverstanden bist, nutze den Bot bitte nicht.",
    sections: [
      {
        id: "scope",
        heading: "1. Zwischen wem diese Bedingungen gelten",
        blocks: [
          `Der Bot wird von ${o.name} (dem Betreiber, Kontaktdaten unten) für den AboutSelphy-Discord-Server betrieben. Er funktioniert nur auf diesem Server. Diese Bedingungen gelten zusätzlich zu den Nutzungsbedingungen und Community-Richtlinien von Discord, die du ebenfalls einhalten musst.`,
        ],
      },
      {
        id: "service",
        heading: "2. Was der Bot bietet",
        blocks: [
          "Der Bot bietet Community-Funktionen wie Moderationswerkzeuge, Logs, Level und Ränge, Tickets, Gewinnspiele, Umfragen, Vorschläge, Rollen-Panels, Geburtstage, Erinnerungen, einen Zählkanal, eigene Befehle, Auto-Antworten, temporäre Sprachräume, Ankündigungen und ein Team-Dashboard. Welche Funktionen aktiv sind, kann unterschiedlich sein und sich ändern.",
          "Der Bot ist ein kostenloser Community-Dienst, der in der Freizeit betrieben wird. Er wird \"wie er ist\" bereitgestellt. Funktionen können sich ändern, ausfallen, pausieren oder jederzeit mit oder ohne Ankündigung entfernt werden.",
        ],
      },
      {
        id: "conduct",
        heading: "3. Wie du ihn nutzen darfst",
        blocks: [
          "Du verpflichtest dich, nicht:",
          {
            list: [
              "den Bot zu missbrauchen, um andere zu spammen, zu belästigen, zu bedrohen oder zu täuschen oder gegen die Regeln von Discord oder das Gesetz zu verstoßen;",
              "Grenzen, Wartezeiten, Berechtigungen oder die Moderation zu umgehen oder Fehler für einen unfairen Vorteil zu nutzen (melde sie bitte stattdessen);",
              "Skripte oder andere Werkzeuge zu verwenden, um Befehle oder Buttons des Bots automatisch zu bedienen;",
              "personenbezogene Daten anderer, rechtswidrige Inhalte oder Inhalte, die du nicht teilen darfst, in den Bot einzugeben (zum Beispiel in einen Vorschlag, ein Ticket oder eine Erinnerung);",
              "ohne Erlaubnis auf das Dashboard, die internen Schnittstellen des Bots oder die Daten anderer zuzugreifen.",
            ],
          },
        ],
      },
      {
        id: "content",
        heading: "4. Was du an den Bot sendest",
        blocks: ["Du bist für Texte und Dateien verantwortlich, die du über den Bot sendest. Mit dem Senden erlaubst du dem Bot und dem Team des Servers, sie so zu verarbeiten, zu speichern und anzuzeigen, wie es für die genutzte Funktion nötig ist (zum Beispiel deinen Vorschlag im Vorschlagskanal anzuzeigen). Die Rechte an deinen eigenen Inhalten bleiben bei dir."],
      },
      {
        id: "moderation",
        heading: "5. Moderation",
        blocks: ["Das Team kann dich verwarnen, stummschalten, mit einem Timeout belegen, kicken oder bannen, Inhalte löschen und den Zugang zu Funktionen entziehen, wenn du gegen diese Bedingungen oder die Server-Regeln verstößt. Solche Maßnahmen werden erfasst. Wenn du eine Entscheidung für falsch hältst, kannst du das Team oder den Betreiber bitten, sie erneut zu prüfen."],
      },
      {
        id: "privacy",
        heading: "6. Deine Daten",
        blocks: ["Wie der Bot mit personenbezogenen Daten umgeht, steht in der Datenschutzerklärung. Manche Funktionen sind freiwillig (zum Beispiel Geburtstage und Erinnerungen) und speichern nur dann Daten, wenn du sie benutzt."],
      },
      {
        id: "third",
        heading: "7. Andere Dienste",
        blocks: ["Der Bot arbeitet mit Discord und kann Links oder öffentliche Informationen von Diensten wie Twitch, YouTube oder TikTok anzeigen. Diese Dienste haben eigene Bedingungen, und der Betreiber ist weder für sie noch für ihre Inhalte verantwortlich."],
      },
      {
        id: "staff",
        heading: "8. Für das Team bei der Nutzung des Dashboards",
        blocks: ["Das Team muss die Daten, die es im Dashboard sieht, vertraulich behandeln, sie nur zur Moderation und zum Betrieb der Community nutzen und nicht anderswo weitergeben oder kopieren. Der Zugang kann jederzeit entzogen werden. Aktionen im Dashboard werden der Person zugeordnet, die sie ausgeführt hat."],
      },
      {
        id: "liability",
        heading: "9. Haftung",
        blocks: [
          "Soweit das Gesetz es erlaubt, haftet der Betreiber nicht für Schäden durch die Nutzung oder Nichtverfügbarkeit des Bots, verlorene Daten oder das Verhalten anderer Nutzer. Das schränkt die Haftung für Vorsatz und grobe Fahrlässigkeit, für Schäden an Leben, Körper oder Gesundheit und dort, wo das Gesetz eine Haftung zwingend vorschreibt, nicht ein.",
        ],
      },
      {
        id: "end",
        heading: "10. Ende der Nutzung",
        blocks: ["Du kannst den Bot jederzeit nicht mehr nutzen, zum Beispiel indem du den Server verlässt. Der Betreiber kann deinen Zugang beenden oder einschränken, insbesondere wenn du gegen diese Bedingungen verstößt. Abschnitte, die ihrer Natur nach fortbestehen sollen (wie Moderationsaufzeichnungen und Haftung), gelten weiter."],
      },
      {
        id: "changes",
        heading: "11. Änderungen dieser Bedingungen",
        blocks: ["Diese Bedingungen können sich ändern, zum Beispiel wenn sich Funktionen oder das Recht ändern. Das Datum oben zeigt die aktuelle Fassung. Wenn du den Bot nach einer Änderung weiter nutzt, nimmst du die neue Fassung an. Wichtige Änderungen werden im Server angekündigt."],
      },
      {
        id: "law",
        heading: "12. Anwendbares Recht",
        blocks: [`Es gilt das Recht von ${o.country}, ohne dass dir die zwingenden Verbraucherschutzvorschriften deines Wohnsitzlandes entzogen werden.`],
      },
      {
        id: "contact",
        heading: "13. Kontakt",
        blocks: [`${o.name}, ${o.address}, ${o.email}`],
      },
    ],
  };
}
