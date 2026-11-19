"use server";

import { revalidatePath } from "next/cache";

import { getCurrentResearcher } from "@/lib/admin/auth";
import {
  AdminCodingError,
  saveReflectionCoding,
  saveReflectionComment,
} from "@/lib/admin/store";
import type {
  ResearcherReflectionCoding,
  ResearcherReflectionComment,
} from "@/lib/admin/types";

type ActionError = { ok: false; error: string };
type ActionSuccess = {
  ok: true;
  entry: ResearcherReflectionComment | null;
};

export async function saveReflectionCommentAction(input: {
  sessionId: string;
  itemId: string;
  comment: string;
}): Promise<ActionSuccess | ActionError> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };

  try {
    const entry = await saveReflectionComment({
      ...input,
      researcherId: researcher.id,
    });
    revalidatePath("/admin");
    return { ok: true, entry };
  } catch (error) {
    console.error(
      "ADMIN-REFLECTION-COMMENT",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: "Kommentaren kunde inte sparas." };
  }
}

// The whole record is sent each time, so a tick never undoes the mark or the
// other way round, whichever request arrives first.
export async function saveReflectionCodingAction(input: {
  sessionId: string;
  itemId: string;
  criteria: string[];
  coded: boolean;
}): Promise<
  { ok: true; entry: ResearcherReflectionCoding | null } | ActionError
> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };

  try {
    const entry = await saveReflectionCoding({
      sessionId: input.sessionId,
      itemId: input.itemId,
      criteria: input.criteria,
      coded: input.coded,
      researcherId: researcher.id,
    });
    revalidatePath("/admin");
    return { ok: true, entry };
  } catch (error) {
    console.error(
      "ADMIN-REFLECTION-CODING",
      error instanceof Error ? error.name : "unknown",
    );
    return {
      ok: false,
      error:
        error instanceof AdminCodingError &&
        error.code === "REFLECTION_NOT_SUBMITTED"
          ? "Reflektionen har inte skickats in, så den kan inte kodas."
          : "Reflektionskodningen kunde inte sparas.",
    };
  }
}
