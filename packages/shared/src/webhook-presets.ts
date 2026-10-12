import { inboundPayload, type InboundPayload } from "./webhooks";

// Provider presets for incoming webhooks: GitHub and Ko-fi send their own formats, and these turn them into the
// plain { title, content, url, color } message the bot posts. Pure (no Node APIs): the signature checks live in
// "webhook-signature". Everything here is untrusted text: it is cut to size, links are only kept for the provider's
// own website, and the result is validated by the same strict schema as a hand-made message.

const obj = (v: unknown): Record<string, unknown> => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max) : "");
const firstLine = (text: string, max: number): string => str(text.split("\n")[0] ?? "", max);
const githubUrl = (u: unknown): string | undefined => (typeof u === "string" && /^https:\/\/github\.com\/[^\s]+$/.test(u) && u.length <= 400 ? u : undefined);
const kofiUrl = (u: unknown): string | undefined => (typeof u === "string" && /^https:\/\/ko-fi\.com\/[^\s]*$/.test(u) && u.length <= 400 ? u : undefined);

const COLOR = { green: 0x2da44e, red: 0xcf222e, purple: 0x8250df, blue: 0x0969da, gold: 0xdbab09, kofi: 0x29abe0 } as const;

const finish = (title: string, content: string, url: string | undefined, color: number): InboundPayload | null => {
  const parsed = inboundPayload.safeParse({ title: title.slice(0, 256), content: content.slice(0, 2000), ...(url ? { url } : {}), color });
  return parsed.success ? parsed.data : null;
};

/** A GitHub webhook delivery (`X-GitHub-Event` + the JSON body) as a message, or null for events and actions we don't post. */
export function githubPayload(event: string, json: unknown): InboundPayload | null {
  const body = obj(json);
  const repo = str(obj(body.repository).name, 100) || "repository";
  const sender = str(obj(body.sender).login, 60) || "someone";
  const action = str(body.action, 40);

  switch (event) {
    case "ping":
      return finish("GitHub webhook connected", str(body.zen, 200), githubUrl(obj(body.repository).html_url), COLOR.blue);

    case "push": {
      if (body.deleted === true) return null;
      const ref = str(body.ref, 200);
      const branch = ref.replace(/^refs\/(heads|tags)\//, "");
      const commits = Array.isArray(body.commits) ? body.commits : [];
      if (commits.length === 0) return null;
      const lines = commits.slice(0, 5).map((c) => {
        const o = obj(c);
        return `\`${str(o.id, 40).slice(0, 7)}\` ${firstLine(str(o.message, 300), 80)} - ${str(obj(o.author).name, 40) || "unknown"}`;
      });
      if (commits.length > 5) lines.push(`... and ${commits.length - 5} more`);
      return finish(`[${repo}:${branch}] ${commits.length} new commit${commits.length === 1 ? "" : "s"}`, lines.join("\n"), githubUrl(body.compare), COLOR.blue);
    }

    case "pull_request": {
      const pr = obj(body.pull_request);
      const verb = action === "closed" ? (pr.merged === true ? "merged" : "closed") : action === "opened" || action === "reopened" || action === "ready_for_review" ? action.replace(/_/g, " ") : null;
      if (!verb) return null;
      const color = verb === "merged" ? COLOR.purple : verb === "closed" ? COLOR.red : COLOR.green;
      return finish(`[${repo}] Pull request #${Number(pr.number) || 0} ${verb}: ${firstLine(str(pr.title, 200), 150)}`, `by ${sender}`, githubUrl(pr.html_url), color);
    }

    case "issues": {
      if (action !== "opened" && action !== "closed" && action !== "reopened") return null;
      const issue = obj(body.issue);
      return finish(`[${repo}] Issue #${Number(issue.number) || 0} ${action}: ${firstLine(str(issue.title, 200), 150)}`, `by ${sender}`, githubUrl(issue.html_url), action === "closed" ? COLOR.red : COLOR.green);
    }

    case "release": {
      if (action !== "published") return null;
      const release = obj(body.release);
      const name = str(release.name, 100) || str(release.tag_name, 100);
      return finish(`[${repo}] Release ${str(release.tag_name, 60)}${name && name !== str(release.tag_name, 60) ? `: ${name}` : ""}`, str(release.body, 300), githubUrl(release.html_url), COLOR.green);
    }

    case "star":
      return action === "created" ? finish(`[${repo}] ${sender} starred the repository`, "", githubUrl(obj(body.repository).html_url), COLOR.gold) : null;

    default:
      return null;
  }
}

export type KofiMessage = { payload: InboundPayload; messageId: string; token: string };

/** A Ko-fi webhook (the JSON inside the form field `data`). Anonymous (non-public) supporters keep their name and message private. */
export function kofiPayload(json: unknown): KofiMessage | null {
  const k = obj(json);
  const token = str(k.verification_token, 200);
  const messageId = str(k.message_id, 100);
  if (token === "" || messageId === "") return null;
  const isPublic = k.is_public === true;
  const who = isPublic ? str(k.from_name, 60) || "Someone" : "Someone";
  const type = str(k.type, 40);
  const verb = type === "Subscription" ? "subscribed" : type === "Shop Order" ? "ordered from the shop" : type === "Commission" ? "commissioned" : "donated";
  const amount = str(k.amount, 20);
  const currency = str(k.currency, 6);
  const payload = finish(`☕ ${who} ${verb}${amount ? ` · ${amount} ${currency}`.trimEnd() : ""}`, isPublic ? str(k.message, 500) : "", kofiUrl(k.url), COLOR.kofi);
  return payload ? { payload, messageId, token } : null;
}
