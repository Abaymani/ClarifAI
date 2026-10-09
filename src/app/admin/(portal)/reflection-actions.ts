"use server";

import { revalidatePath } from "next/cache";

import { getCurrentResearcher } from "@/lib/admin/auth";
import { saveReflectionComment } from "@/lib/admin/store";
import type { ResearcherReflectionComment } from "@/lib/admin/types";

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
