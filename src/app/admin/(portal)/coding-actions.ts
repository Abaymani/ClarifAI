"use server";

import { revalidatePath } from "next/cache";

import { getCurrentResearcher } from "@/lib/admin/auth";
import {
  deleteSequenceCoding,
  savePromptCoding,
  saveSequenceCoding,
} from "@/lib/admin/store";
import type {
  ResearcherPromptCoding,
  ResearcherSequenceCoding,
} from "@/lib/admin/types";

type ActionError = { ok: false; error: string };
type ActionSuccess<T> = { ok: true; entry: T };

export async function savePromptCodingAction(input: {
  sessionId: string;
  message: number;
  note: string;
  codes: string[];
}): Promise<ActionSuccess<ResearcherPromptCoding> | ActionError> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };

  try {
    const entry = await savePromptCoding({
      ...input,
      researcherId: researcher.id,
    });
    revalidatePath("/admin");
    return { ok: true, entry };
  } catch (error) {
    console.error(
      "ADMIN-CODING-PROMPT",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: "Kodningen kunde inte sparas." };
  }
}

export async function saveSequenceCodingAction(input: {
  sessionId: string;
  id: string;
  firstMessage: number;
  lastMessage: number;
  note: string;
  codes: string[];
}): Promise<ActionSuccess<ResearcherSequenceCoding> | ActionError> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };

  try {
    const entry = await saveSequenceCoding({
      ...input,
      researcherId: researcher.id,
    });
    revalidatePath("/admin");
    return { ok: true, entry };
  } catch (error) {
    console.error(
      "ADMIN-CODING-SEQUENCE",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: "Sekvenskodningen kunde inte sparas." };
  }
}

export async function deleteSequenceCodingAction(input: {
  sessionId: string;
  id: string;
}): Promise<{ ok: true; id: string } | ActionError> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };

  try {
    await deleteSequenceCoding({
      ...input,
      researcherId: researcher.id,
    });
    revalidatePath("/admin");
    return { ok: true, id: input.id };
  } catch (error) {
    console.error(
      "ADMIN-CODING-DELETE",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: "Sekvenskodningen kunde inte tas bort." };
  }
}
