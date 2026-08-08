/**
 * Secure UUID Generator for SerenaPsi entities.
 * Uses native Web Crypto API crypto.randomUUID() to guarantee cryptographically strong,
 * non-colliding UUID v4 identifiers across browser tabs, sequential creations, and sessions.
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}
