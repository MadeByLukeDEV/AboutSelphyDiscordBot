// Types shared by the service, the actions and the client component. No server-only imports.

export type ProductWatchRow = {
  id: string;
  name: string;
  url: string;
  channelId: string;
  pingRoleId: string | null;
  enabled: boolean;
  baselined: boolean;
  /** The product's name and the lowest price seen at the last look (in the shop's own currency), or null before the first look. */
  seenTitle: string | null;
  seenPrices: string[];
  seenAvailable: boolean | null;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastChangedAt: string | null;
};

export type ProductWatchError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "tooMany" | "notFound" | "failed";
export type ProductWatchResult = { ok: true; botNotified: boolean } | { ok: false; error: ProductWatchError };
