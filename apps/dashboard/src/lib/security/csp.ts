// Content-Security-Policy, built per request with a fresh nonce (see
// src/proxy.ts). Same policy shape as Main: strict nonce CSP on every page.
//
// Add an origin here only together with the feature that needs it, and say
// which one (e.g. Discord CDN avatars/emoji -> img-src).

const isDev = process.env.NODE_ENV === "development";

export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildCsp(
  nonce: string,
  // Origin of the central auth service: the sign-out button is a form POST to
  // it (src/modules/auth/components/sign-out-button.tsx).
  authOrigin: string,
): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic': scripts loaded by a nonce'd script are trusted too
    // (Next's chunk loading). Dev needs 'unsafe-eval' for React's HMR.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // React `style` attributes and sonner's injected <style> need
    // 'unsafe-inline'. Never add a nonce here: browsers then ignore it.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", authOrigin],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
