/**
 * Helpers for the lightweight session-hint cookie used by middleware.ts.
 *
 * This cookie does NOT hold a secret token — it is a simple "logged-in" flag
 * so the Edge middleware can redirect unauthenticated visitors before the page
 * renders, eliminating the flash-of-unauthenticated-content.
 *
 * The client-side AuthGuard remains as the authoritative check; if the cookie
 * is present but the Firebase token has expired, AuthGuard will redirect.
 */

const COOKIE_NAME = "__session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

/** Call after successful Firebase sign-in. */
export function setSessionCookie(): void {
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
}

/** Call before or after Firebase sign-out. */
export function clearSessionCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax; Secure`;
}

/** The cookie name — used by middleware.ts. */
export const SESSION_COOKIE_NAME = COOKIE_NAME;
