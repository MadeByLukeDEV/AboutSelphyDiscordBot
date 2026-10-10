// Types shared by the service, the actions and the client components. No server-only imports.

export type AutoPublishError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "alreadyAdded" | "notFound" | "failed";
export type AutoPublishResult = { ok: true; botNotified: boolean } | { ok: false; error: AutoPublishError };
