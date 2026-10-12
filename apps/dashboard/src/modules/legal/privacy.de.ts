import type { LegalDoc, Operator } from "./types";

export function privacyDe(o: Operator): LegalDoc {
  return {
    title: "Datenschutzerklärung",
    intro:
      "Diese Erklärung beschreibt, welche personenbezogenen Daten der AboutSelphy-Bot und sein Team-Dashboard verarbeiten, warum, wie lange und was du dagegen tun kannst. Sie richtet sich an die Mitglieder des AboutSelphy-Discord-Servers. Der Bot funktioniert nur auf diesem einen Server.",
    sections: [
      {
        id: "controller",
        heading: "1. Verantwortlicher",
        blocks: [
          "Verantwortlich für die hier beschriebene Verarbeitung ist:",
          { list: [o.name, o.address, `E-Mail: ${o.email}`, `Land: ${o.country}`] },
          "Discord Inc. betreibt die Plattform Discord und ist für das, was es mit deinem Konto tut, ein eigener Verantwortlicher. Bitte lies auch die Datenschutzerklärung von Discord. Diese Erklärung betrifft nur das, was der Bot und das Dashboard zusätzlich zu Discord tun.",
        ],
      },
      {
        id: "what",
        heading: "2. Was der Bot verarbeitet und warum",
        blocks: [
          "Der Bot erhält die Informationen, die Discord jedem Bot auf einem Server gibt: deine Nutzer-ID, deinen Benutzernamen und Server-Spitznamen, die Adresse deines Profilbilds, deine Rollen, das Beitrittsdatum sowie Ereignisse wie Nachrichten, Reaktionen und Beitritte oder Austritte in Sprachkanälen. Damit führt er seine Funktionen aus. Was darüber hinaus gespeichert wird, hängt von der Funktion ab:",
          {
            list: [
              "Moderation (Verwarnungen, Timeouts, Kicks, Banns, Notizen, Fälle): deine Nutzer-ID und dein Name zu dem Zeitpunkt, die moderierende Person, der Grund, der Zeitpunkt und bei zeitlich begrenzten Maßnahmen die Dauer. Maßnahmen, die ein Moderator direkt in Discord durchführt, werden ebenfalls erfasst. Zweck: eine sichere und faire Community.",
              "Server-Logs (Beitritte und Austritte mit Kontoalter, Änderungen von Spitznamen und Rollen, Beitritte, Austritte und Wechsel in Sprachkanälen, Änderungen an Kanälen und Rollen, bearbeitete und gelöschte Nachrichten): Diese werden in private Team-Kanäle in Discord gepostet und nicht in der eigenen Datenbank des Bots gespeichert. Bei bearbeiteten und gelöschten Nachrichten wird der Text nur gezeigt, wenn der Bot ihn noch im Speicher hatte.",
              "Level: deine Nutzer-ID, dein Anzeigename, Erfahrungspunkte und Zähler (Anzahl der Nachrichten und Sprachminuten). Der Inhalt deiner Nachrichten wird dafür nicht gelesen. Zweck: Rang, Bestenliste und Rollenbelohnungen. Schaltet der Betreiber die öffentliche Ranglisten-Seite ein, werden dein Anzeigename, Level und XP dort für alle mit dem Link angezeigt; mit /mydata hide kannst du dich ausblenden.",
              "Tickets: wer das Ticket eröffnet hat, wer es bearbeitet hat und die Nachrichten im privaten Ticket-Kanal. Beim Schließen wird ein Protokoll (bis zu 2.000 Nachrichten) gespeichert, damit das Team es später ansehen kann. Zweck: Support und Klärung von Streitfällen.",
              "Geburtstage (freiwillig): Tag und Monat, die du wählst, nie das Jahr, sowie dein Name. Nur wenn du /birthday set benutzt.",
              "Temporäre Sprachräume (freiwillig, nur wenn der Betreiber es einschaltet): Name, Limit, Sperre und Video-/Ton-Einstellungen deines letzten Raums, damit dein nächster genauso startet. Wird mit /mydata delete gelöscht.",
              "Einladungs-Tracking: über welche Einladung du beigetreten bist und wer sie erstellt hat (deine Nutzer-ID und dein Name, die des Einladenden, sowie wann du beigetreten und gegangen bist). Zweck: sehen, woher Mitglieder kommen, und Missbrauch erkennen.",
              "Prüfliste (optional, nur wenn der Betreiber sie einschaltet): Beim Beitritt wird in einem Team-Kanal eine Karte mit deiner Nutzer-ID, deinem Namen, dem Erstellungsdatum deines Kontos und dem Beitrittsdatum gepostet, später die Entscheidung (aufgenommen, abgelehnt oder gegangen) samt entscheidendem Teammitglied. Gespeichert, bis der Betreiber den Eintrag entfernt; du kannst die Löschung verlangen (Abschnitt 8).",
              "Twitch-VIP-Verknüpfung (freiwillig): deine Discord-ID und dein Name sowie der Twitch-Kontoname, den du mit /vip link angibst. Nutzt du den Button „Mit Discord verknüpfen“, zeigt uns Discord einmalig das mit deinem Profil verbundene Twitch-Konto (wir fragen nur nach deiner Identität und deinen Verbindungen, behalten nur Twitch-Konto-ID und -Namen und verwerfen das Zugriffstoken sofort); tippst du stattdessen einen Namen, bestätigt das Team ihn, bevor eine Rolle vergeben wird. Nur wenn du /vip link benutzt.",
              "Erinnerungen (freiwillig): der Text und die Zeit, die du mit /remind eingibst. Nur wenn du /remind benutzt.",
              "Vorschläge, Umfragen und Gewinnspiele: dein Vorschlagstext und Name, deine Stimmen und Teilnahmen. Sie werden mit deiner Nutzer-ID gespeichert, damit niemand doppelt abstimmen oder teilnehmen kann. Stimmen in Umfragen werden anderen nur als Zahlen gezeigt.",
              "Starboard: Erhält eine Nachricht genug Reaktionen, wird sie mit Text, Name, Bild und einem Link zum Original in einem Schaukasten-Kanal erneut gepostet.",
              "Willkommen: die Rollen, die du beim Beitritt bekommst. Wenn aktiviert, werden die Rollen, die du beim Verlassen hattest, gemerkt, damit sie bei einer Rückkehr wiederhergestellt werden können.",
              "Zählkanal: die dort gesendeten Zahlen und wer zuletzt gezählt hat.",
              "Temporäre Sprachräume: wem ein Raum gehört und seine Einstellungen. Die Einstellungen liegen im Discord-Kanal selbst.",
              "Nachrichten werden live gelesen (nicht gespeichert) für Funktionen, die auf Text reagieren: Auto-Antworten, der Zählkanal, angeheftete Nachrichten und Nachrichten-Logs. Dafür braucht der Bot die Discord-Berechtigung \"Nachrichteninhalt\".",
              "Feeds, Twitch- und YouTube-Ankündigungen nutzen öffentliche Informationen über die eigenen Kanäle des Betreibers. Sie verarbeiten keine Daten von Mitgliedern.",
              "Webhooks: Nachrichten, die andere Dienste an die eingehenden Webhook-Adressen des Bots senden, werden als Discord-Nachricht gepostet. Der Bot behält sie darüber hinaus nicht.",
            ],
          },
        ],
      },
      {
        id: "dashboard",
        heading: "3. Das Team-Dashboard",
        blocks: [
          "Das Dashboard ist nur für das Team des Servers. Das Team meldet sich über einen separaten zentralen Anmeldedienst (auth.aboutselphy.com) an, der Konto, Sitzung und deren Cookie nach seinen eigenen Regeln verwaltet. Das Dashboard prüft die Team-Rolle und speichert bei manchen Aktionen den Namen der Person, die sie ausgeführt hat (zum Beispiel wer eine Umfrage erstellt oder eine Rolle gelöscht hat).",
          "Das Dashboard verwendet nur technisch notwendigen Speicher: das Anmelde-Cookie des zentralen Dienstes, ein Sprach-Cookie und ein gemerktes Farbschema. Es gibt keine Analyse, keine Werbung und kein Tracking.",
        ],
      },
      {
        id: "basis",
        heading: "4. Rechtsgrundlagen",
        blocks: [
          {
            list: [
              "Betrieb einer sicheren und gut moderierten Community, Verhinderung von Missbrauch und Sicherheit des Bots: berechtigte Interessen, Art. 6 Abs. 1 lit. f DSGVO.",
              "Funktionen, die du selbst nutzt (Geburtstag, Erinnerungen, Rang, Vorschläge, Tickets, Gewinnspiel-Teilnahmen, Stimmen): Erbringung dessen, was du möchtest, Art. 6 Abs. 1 lit. b DSGVO, und bei den freiwilligen Geburtstags- und Erinnerungsdaten deine Entscheidung, den Befehl zu nutzen, Art. 6 Abs. 1 lit. a DSGVO. Du kannst jederzeit widerrufen (siehe Abschnitt 8).",
              "Wenn du einer Verarbeitung auf Grundlage berechtigter Interessen nicht zustimmst, kannst du widersprechen (Abschnitt 8).",
            ],
          },
        ],
      },
      {
        id: "recipients",
        heading: "5. Wer Daten erhält",
        blocks: [
          "Das Team des Servers sieht die Daten, die es für seine Aufgabe braucht (Moderatoren sehen Fälle und Tickets, Administratoren die Einstellungen). Nichts wird verkauft, für Werbung genutzt oder zur Profilbildung verwendet.",
          { list: [`Hosting: Der Bot, das Dashboard und die Datenbank laufen auf ${o.hosting}.`, "Discord Inc.: die Plattform, auf der der Bot arbeitet. Alles, was der Bot postet oder liest, läuft über Discord.", "Cloudflare: liefert die Webadresse des Dashboards aus (der Datenverkehr läuft darüber).", "Fremde Seiten wie Twitch, YouTube oder TikTok werden nur für öffentliche Informationen über die Kanäle des Betreibers gelesen, ihre Links können im Server angezeigt werden."] },
        ],
      },
      {
        id: "transfers",
        heading: "6. Übermittlung außerhalb der EU/des EWR",
        blocks: ["Discord und Cloudflare haben ihren Sitz in den USA. Sie übermitteln Daten nach ihren eigenen Bedingungen, die sich auf das EU-US Data Privacy Framework und/oder Standardvertragsklauseln stützen. Die eigene Datenbank des Bots bleibt beim oben genannten Hosting."],
      },
      {
        id: "retention",
        heading: "7. Wie lange Daten gespeichert werden",
        blocks: [
          {
            list: [
              "Geburtstage, Erinnerungen und deine Twitch-VIP-Verknüpfung: gelöscht, wenn du sie entfernst (/birthday remove, /remind cancel, /vip unlink) oder den Server verlässt. Zugestellte Erinnerungen werden nach einem Tag gelöscht.",
              "Gemerkte Rollen nach dem Verlassen: 90 Tage.",
              "Moderationsfälle und Notizen: gespeichert, solange sie gebraucht werden, um die Community zu schützen und Einsprüche zu beantworten; sie werden nach dem vom Betreiber festgelegten Zeitraum automatisch entfernt (dauerhafte Banns ausgenommen). Du kannst die Löschung verlangen (Abschnitt 8).",
              "Ticket-Protokolle, entschiedene Vorschläge und inaktive Level-Einträge: werden nach dem vom Betreiber festgelegten Zeitraum automatisch entfernt. Umfragen, Gewinnspiel-Teilnahmen und Starboard-Beiträge: gespeichert, solange die Funktion genutzt wird und bis du sie mit /mydata delete löschst oder der Betreiber sie entfernt.",
              "Über welche Einladung du beigetreten bist: ein Jahr. Das Änderungsprotokoll des Dashboards (welches Teammitglied wann welche Einstellung geändert hat): ein Jahr.",
              "Server-Logs in Team-Kanälen: solange das Team die Nachrichten in diesen Discord-Kanälen behält.",
              "Technische Logs des Bots (Nutzer- und Kanal-IDs, Fehler) liegen auf dem Server und werden vom Hosting-Setup rotiert. Sie enthalten keinen Nachrichtentext.",
            ],
          },
        ],
      },
      {
        id: "rights",
        heading: "8. Deine Rechte",
        blocks: [
          `Du kannst den Betreiber unter ${o.email} (oder eine Person des Teams auf dem Server) um Auskunft über deine Daten, Berichtigung, Löschung, Einschränkung und eine Kopie in einem gängigen Format bitten, du kannst Verarbeitungen auf Grundlage berechtigter Interessen widersprechen und eine Einwilligung jederzeit widerrufen. Du bekommst innerhalb eines Monats eine Antwort.`,
          "Mit /mydata export siehst du alles, was über dich gespeichert ist (eine Datei, die nur du bekommst), und mit /mydata delete löschst du das meiste davon (Geburtstag, Erinnerungen, Level-Eintrag, gemerkte Rollen, Stimmen, Gewinnspiel-Teilnahmen und deine Twitch-Verknüpfung; dein Name wird aus Vorschlägen und Starboard-Beiträgen entfernt). Manche Daten kannst du auch selbst löschen: /birthday remove, /remind cancel und indem du den Server verlässt (das entfernt deinen Geburtstag und deine Erinnerungen). Eine Löschung kann abgelehnt werden, wenn die Daten weiterhin gebraucht werden, um andere zu schützen oder einen Rechtsanspruch zu verteidigen, zum Beispiel ein aktiver Bann-Eintrag.",
          "Du hast das Recht, dich bei einer Datenschutzbehörde zu beschweren, insbesondere in dem Land, in dem du lebst oder arbeitest.",
        ],
      },
      {
        id: "security",
        heading: "9. Sicherheit",
        blocks: ["Der Zugriff auf das Dashboard ist auf Team-Rollen beschränkt und wird bei jeder Aktion geprüft. Verbindungen nutzen HTTPS. Geheimnisse wie Token und Webhook-Adressen werden verschlüsselt gespeichert. Der Bot tut nur, was die Einstellungen im Dashboard erlauben, und vergibt keine gefährlichen Berechtigungen."],
      },
      {
        id: "children",
        heading: "10. Mindestalter",
        blocks: ["Discord verlangt von seinen Nutzern ein Alter von mindestens 13 Jahren, oder mehr, wo das örtliche Recht es vorsieht. Der Bot ist nicht für jüngere Personen gedacht und verarbeitet deren Daten nicht wissentlich. Wenn du glaubst, dass das passiert ist, wende dich an den Betreiber."],
      },
      {
        id: "changes",
        heading: "11. Änderungen",
        blocks: ["Diese Erklärung ändert sich, wenn sich Funktionen oder das Recht ändern. Das Datum oben zeigt die aktuelle Fassung. Wichtige Änderungen werden im Server angekündigt."],
      },
      {
        id: "contact",
        heading: "12. Kontakt",
        blocks: [`${o.name}, ${o.email}`],
      },
    ],
  };
}
