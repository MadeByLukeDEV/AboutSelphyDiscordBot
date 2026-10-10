import type { MetadataRoute } from "next";

// This is a private staff dashboard: nothing on it is for search engines, archives or AI crawlers.
// Well-behaved crawlers obey this; everything else meets the sign-in gate (every page redirects to
// the login) and the X-Robots-Tag header on every response (next.config.ts).
const AI_CRAWLERS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "Google-Extended", "CCBot", "PerplexityBot", "Bytespider", "Applebot-Extended", "Amazonbot", "cohere-ai", "Meta-ExternalAgent", "FacebookBot", "ia_archiver"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
  };
}
