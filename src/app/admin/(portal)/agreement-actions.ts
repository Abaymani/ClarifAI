"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentResearcher } from "@/lib/admin/auth";
import type { ChangeVariant } from "@/lib/admin/coder-agreement";
import { MAX_FRAMEWORK_CHANGES } from "@/lib/admin/framework-changes";
import { runCoderAgreement, tryFrameworkChanges } from "@/lib/admin/store";

const changesSchema = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("merge"),
        codes: z.array(z.string()).max(40),
        level: z.enum(["P", "A", "C"]),
      }),
      z.object({ kind: z.literal("delete"), code: z.string() }),
    ]),
  )
  .max(MAX_FRAMEWORK_CHANGES);

export async function runCoderAgreementAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };

  try {
    await runCoderAgreement(researcher.id);
    revalidatePath("/admin/agreement");
    return { ok: true };
  } catch (error) {
    console.error(
      "ADMIN-CODER-AGREEMENT",
      error instanceof Error ? error.name : "unknown",
    );
    return {
      ok: false,
      error: "Beräkningen misslyckades. Det förra resultatet ligger kvar.",
    };
  }
}

// Only reads and calculates, so there is nothing to revalidate (DL-078).
export async function tryFrameworkChangesAction(
  input: unknown,
): Promise<
  { ok: true; variants: ChangeVariant[] } | { ok: false; error: string }
> {
  const researcher = await getCurrentResearcher();
  if (!researcher) return { ok: false, error: "Du är inte längre inloggad." };
  const changes = changesSchema.safeParse(input);
  if (!changes.success) {
    return { ok: false, error: "Ändringarna kunde inte läsas." };
  }

  try {
    const result = await tryFrameworkChanges(changes.data);
    return result.ok
      ? { ok: true, variants: result.variants }
      : { ok: false, error: result.problem };
  } catch (error) {
    console.error(
      "ADMIN-FRAMEWORK-CHANGES",
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false, error: "Beräkningen med ändringarna misslyckades." };
  }
}
