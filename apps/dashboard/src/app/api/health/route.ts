// Docker/Dokploy health check. Open on purpose and reveals nothing. When the
// dashboard gets its own tables (phase 1), add a `SELECT 1` with a short
// timeout here, like Main's /api/health.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
