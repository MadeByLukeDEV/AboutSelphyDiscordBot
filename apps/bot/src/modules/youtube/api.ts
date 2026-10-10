import { z } from "zod";
import { parseIsoDuration, type UploadCandidate } from "./logic";

// YouTube Data API v3, read-only and with a plain API key. Cost: playlistItems.list and
// videos.list are 1 quota unit each (search.list would be 100: never used). Failures are
// a short code and the HTTP status, never the response body and never the key.

const TIMEOUT_MS = 10_000;
const BASE = "https://www.googleapis.com/youtube/v3";

export type YoutubeErrorCode = "quota" | "keyRejected" | "notFound" | "failed";

export class YoutubeError extends Error {
  constructor(
    readonly code: YoutubeErrorCode,
    readonly status?: number,
  ) {
    super(`youtube: ${code}${status ? ` (${status})` : ""}`);
    this.name = "YoutubeError";
  }
}

async function get(path: string, params: Record<string, string>, apiKey: string): Promise<unknown> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // The key goes in a header, not the address, so it can't end up in a logged URL.
  let res: Response;
  try {
    res = await fetch(url, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new YoutubeError("failed");
  }
  if (res.status === 403 || res.status === 429) {
    const reason = ((await res.json().catch(() => null)) as { error?: { errors?: Array<{ reason?: string }> } } | null)?.error?.errors?.[0]?.reason ?? "";
    throw new YoutubeError(reason.toLowerCase().includes("quota") || res.status === 429 ? "quota" : "keyRejected", res.status);
  }
  if (res.status === 400 || res.status === 401) throw new YoutubeError("keyRejected", res.status);
  if (res.status === 404) throw new YoutubeError("notFound", 404);
  if (!res.ok) throw new YoutubeError("failed", res.status);
  return res.json().catch(() => {
    throw new YoutubeError("failed", res.status);
  });
}

const playlist = z.object({
  items: z
    .array(
      z.object({
        snippet: z.object({ title: z.string(), resourceId: z.object({ videoId: z.string() }) }),
        contentDetails: z.object({ videoPublishedAt: z.string().optional() }).default({}),
      }),
    )
    .default([]),
});

const videos = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({
          title: z.string(),
          publishedAt: z.string(),
          channelTitle: z.string().default(""),
          liveBroadcastContent: z.string().default("none"),
          thumbnails: z.record(z.string(), z.object({ url: z.string() })).default({}),
        }),
        contentDetails: z.object({ duration: z.string() }),
        status: z.object({ privacyStatus: z.string() }),
      }),
    )
    .default([]),
});

export type VideoDetails = UploadCandidate & { channelTitle: string; thumbnailUrl: string | null };

/** The newest video IDs of the uploads playlist (newest first). */
export async function latestUploadIds(apiKey: string, playlistId: string, max = 10): Promise<string[]> {
  const parsed = playlist.safeParse(await get("playlistItems", { part: "snippet,contentDetails", playlistId, maxResults: String(max) }, apiKey));
  if (!parsed.success) throw new YoutubeError("failed");
  return parsed.data.items.map((i) => i.snippet.resourceId.videoId);
}

/** Details for up to 50 videos. A video that isn't returned (private, deleted) is simply absent. */
export async function videoDetails(apiKey: string, ids: string[]): Promise<VideoDetails[]> {
  if (ids.length === 0) return [];
  const parsed = videos.safeParse(await get("videos", { part: "snippet,contentDetails,status", id: ids.slice(0, 50).join(",") }, apiKey));
  if (!parsed.success) throw new YoutubeError("failed");
  return parsed.data.items.map((v) => {
    const thumbs = v.snippet.thumbnails;
    return {
      videoId: v.id,
      title: v.snippet.title,
      publishedAt: new Date(v.snippet.publishedAt),
      durationSeconds: parseIsoDuration(v.contentDetails.duration),
      privacy: v.status.privacyStatus,
      liveState: v.snippet.liveBroadcastContent,
      channelTitle: v.snippet.channelTitle,
      thumbnailUrl: (thumbs.maxres ?? thumbs.standard ?? thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? null,
    };
  });
}
