"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getCurrentResearcher } from "@/lib/admin/auth";
import {
  adminLessonAnalysisStore,
  requestAdminLessonAnalysis,
} from "@/lib/admin/analysis";
import type { AdminLessonAnalysisRequest } from "@/lib/admin/types";
import { defaultRunDependencies, runAnalysis } from "@/lib/analysis/run";

type ActionResult =
  | { ok: true; request: AdminLessonAnalysisRequest }
  | { ok: false; error: string; alreadyRequested?: boolean };

export async function requestAdminLessonAnalysisAction(input: {
  sessionId: string;
}): Promise<ActionResult> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };

  const attemptId = randomUUID();
  try {
    const result = await requestAdminLessonAnalysis({
      sessionId: input.sessionId,
      researcherId: researcher.id,
      attemptId,
    });
    if (!result.ok) {
      if (result.reason === "ALREADY_REQUESTED") {
        return {
          ok: false,
          error: "En AI-analys har redan beställts för den här lektionen.",
          alreadyRequested: true,
        };
      }
      if (result.reason === "NO_TRANSCRIPT") {
        return {
          ok: false,
          error: "Lektionen måste vara färdiginlämnad med ett transkript.",
        };
      }
      return { ok: false, error: "Lektionen kan inte analyseras." };
    }

    after(() =>
      runAnalysis(
        input.sessionId,
        attemptId,
        defaultRunDependencies(adminLessonAnalysisStore),
      ),
    );
    revalidatePath("/admin");
    return { ok: true, request: result.request };
  } catch (error) {
    console.error(
      "ADMIN-LESSON-ANALYSIS",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: "AI-analysen kunde inte startas." };
  }
}
