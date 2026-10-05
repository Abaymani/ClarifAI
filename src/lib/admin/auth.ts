import "server-only";

import { cache } from "react";
import type { DecodedIdToken } from "firebase-admin/auth";
import { cookies } from "next/headers";

import { getAdminAuth } from "@/lib/firebase/auth";

export const ADMIN_SESSION_COOKIE = "clarifai_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const RECENT_SIGN_IN_SECONDS = 5 * 60;

export type ResearcherId = "R1" | "R2";

export type Researcher = {
  id: ResearcherId;
  email: string;
};

export type FirebaseWebAuthConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  emulatorUrl: string | null;
};

export function researcherForClaims(
  claims: Pick<DecodedIdToken, "email" | "email_verified" | "firebase">,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Researcher | null {
  if (
    !claims.email ||
    claims.email_verified !== true ||
    claims.firebase?.sign_in_provider !== "google.com"
  ) {
    return null;
  }

  const email = normaliseEmail(claims.email);
  const configured: [ResearcherId, string | undefined][] = [
    ["R1", env.ADMIN_RESEARCHER_1_EMAIL],
    ["R2", env.ADMIN_RESEARCHER_2_EMAIL],
  ];
  const match = configured.find(
    ([, configuredEmail]) =>
      configuredEmail && normaliseEmail(configuredEmail) === email,
  );
  return match ? { id: match[0], email } : null;
}

export function firebaseWebAuthConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): FirebaseWebAuthConfig | null {
  const emulatorHost = env.FIREBASE_AUTH_EMULATOR_HOST?.trim();
  const projectId = (
    emulatorHost
      ? env.GCLOUD_PROJECT || "demo-clarifai"
      : env.FIREBASE_PROJECT_ID
  )?.trim();
  const apiKey = (
    emulatorHost
      ? env.FIREBASE_WEB_API_KEY || "demo-key"
      : env.FIREBASE_WEB_API_KEY
  )?.trim();

  if (!projectId || !apiKey) return null;
  return {
    apiKey,
    projectId,
    authDomain: `${projectId}.firebaseapp.com`,
    emulatorUrl: emulatorHost ? `http://${emulatorHost}` : null,
  };
}

export async function createResearcherSession(
  idToken: string,
  now: Date = new Date(),
): Promise<{ sessionCookie: string; researcher: Researcher } | null> {
  const auth = getAdminAuth();
  const claims = await auth.verifyIdToken(idToken, true);
  const researcher = researcherForClaims(claims);
  const signedInAt = claims.auth_time;
  if (
    !researcher ||
    typeof signedInAt !== "number" ||
    now.getTime() / 1000 - signedInAt > RECENT_SIGN_IN_SECONDS
  ) {
    return null;
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });
  return { sessionCookie, researcher };
}

export const getCurrentResearcher = cache(
  async (): Promise<Researcher | null> => {
    const sessionCookie = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;

    try {
      const claims = await getAdminAuth().verifySessionCookie(
        sessionCookie,
        true,
      );
      return researcherForClaims(claims);
    } catch {
      return null;
    }
  },
);

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}
