// Types shared by the service, the actions and the client components. No server-only imports.

export type CardImageView = { width: number; height: number; uploadedByName: string; uploadedAt: string };
export type CardImageError = "forbidden" | "noFile" | "type" | "size" | "dimensions" | "failed" | "invalid";
export type CardImageResult = { ok: true } | { ok: false; error: CardImageError };
