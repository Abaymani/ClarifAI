import type { ResearcherId } from "@/lib/admin/auth";

export const RESEARCHER_NAMES: Record<ResearcherId, string> = {
  R1: "Armin",
  R2: "Frida",
};

export function researcherName(researcherId: ResearcherId): string {
  return RESEARCHER_NAMES[researcherId];
}
