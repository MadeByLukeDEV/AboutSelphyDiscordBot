// Types shared by the service, the actions and the client components. No server-only imports.
// The feed address is a secret (bridges carry access keys in it): only its host ever reaches the client.

export type FeedRow = {
  id: string;
  name: string;
  host: string;
  channelId: string;
  pingRoleId: string | null;
  messageTemplate: string;
  intervalMinutes: number;
  includeWords: string[];
  excludeWords: string[];
  useEmbed: boolean;
  filterDescription: boolean;
  digest: boolean;
  enabled: boolean;
  baselined: boolean;
  lastCheckedAt: string | null;
  lastStatus: string | null;
};

export type FeedError = "forbidden" | "invalid" | "notReady" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "tooMany" | "notFound" | "failed";
export type SaveFeedResult = { ok: true; botNotified: boolean } | { ok: false; error: FeedError };
export type CheckFeedResult = { ok: true; status: string; announced: number } | { ok: false; error: FeedError };
