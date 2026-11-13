"use server";

import { updateTag } from "next/cache";

import { getCurrentResearcher } from "@/lib/admin/auth";
import { RESEARCH_DATA_TAG } from "@/lib/admin/cached-research-data";

// Expires the portal's cached copy, so the page reloads with fresh data (DL-081).
export async function refreshResearchDataAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };
  updateTag(RESEARCH_DATA_TAG);
  return { ok: true };
}
