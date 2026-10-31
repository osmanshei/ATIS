export const APP_SESSION_COOKIE = "atis_app_session_started_at";
export const APP_SESSION_DURATION_SECONDS = 6 * 60 * 60;

export function isAppSessionValid(value: string | undefined | null, now = Date.now()) {
  if (!value) return false;
  const startedAt = Number(value);
  if (!Number.isFinite(startedAt) || startedAt <= 0 || startedAt > now) return false;
  return now - startedAt < APP_SESSION_DURATION_SECONDS * 1000;
}
