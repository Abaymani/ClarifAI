import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "clarifai_session";
// A lesson is one sitting; the cookie should not outlive the school day.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

// Only the hash is stored, so a copy of the database does not let anyone resume
// a student's session.
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
