"use server";

import { revalidatePath } from "next/cache";

import { getCurrentResearcher } from "@/lib/admin/auth";
import { runCoderAgreement } from "@/lib/admin/store";

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
