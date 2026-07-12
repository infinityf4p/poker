export const ADMIN_COOKIE = 'poker_admin_session';
export const USER_COOKIE = 'poker_user_session';
/** @deprecated Use USER_COOKIE. Kept while the realtime client migrates to room-scoped auth. */
export const PLAYER_COOKIE = USER_COOKIE;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export function sessionCookieOptions(production: boolean) {
  return {
    path: '/',
    httpOnly: true,
    secure: production,
    sameSite: 'lax' as const,
    maxAge: SESSION_TTL_MS / 1_000,
  };
}
