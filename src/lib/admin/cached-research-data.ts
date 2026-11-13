// The portal's overview and analysis pages read every session and every coding
// entry, which used up Firebase Spark's daily reads. They share one server-side
// copy for ten minutes instead; `Uppdatera` fetches a fresh one (DL-081).
import "server-only";

import { unstable_cache } from "next/cache";

import {
  listAdminOverview,
  loadAgreementInputs,
  loadStudentDevelopment,
} from "@/lib/admin/store";

export const RESEARCH_DATA_TAG = "research-data";
export const RESEARCH_DATA_SECONDS = 10 * 60;

export type Fetched<T> = { data: T; fetchedAt: string };

// Formatted on the server, so the server and the browser agree on the time zone.
const FETCHED_AT = new Intl.DateTimeFormat("sv-SE", {
  timeStyle: "short",
  timeZone: "Europe/Stockholm",
});

export function formatFetchedAt(fetchedAt: string): string {
  return FETCHED_AT.format(new Date(fetchedAt));
}

// Vercel keeps this cache across deploys, so the key names the deployment: a new
// version never reads data cached in an older version's shape.
export function deploymentKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return env.VERCEL_DEPLOYMENT_ID ?? env.VERCEL_GIT_COMMIT_SHA ?? "local";
}

// unstable_cache stays shared across Vercel instances without Cache Components;
// `use cache: remote` would need them switched on for the whole app.
export function cachedResearchData<T>(
  name: string,
  load: () => Promise<T>,
): () => Promise<Fetched<T>> {
  return unstable_cache(
    async () => ({ data: await load(), fetchedAt: new Date().toISOString() }),
    ["research-data", name, deploymentKey()],
    { tags: [RESEARCH_DATA_TAG], revalidate: RESEARCH_DATA_SECONDS },
  );
}

// Only pseudonymous codes, message numbers and counts, never transcript text.
export const cachedAdminOverview = cachedResearchData(
  "admin-overview",
  listAdminOverview,
);
export const cachedStudentDevelopment = cachedResearchData(
  "student-development",
  loadStudentDevelopment,
);
export const cachedAgreementInputs = cachedResearchData(
  "agreement-inputs",
  loadAgreementInputs,
);
