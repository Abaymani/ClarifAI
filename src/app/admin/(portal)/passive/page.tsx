import { redirect } from "next/navigation";

import { LessonOneCodesNotice } from "@/app/admin/(portal)/lesson-one-codes-notice";
import { PassiveShareView } from "@/app/admin/(portal)/passive/passive-share-view";
import { getCurrentResearcher } from "@/lib/admin/auth";
import { loadLessonOneCodes, loadStudentDevelopment } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export default async function AdminPassiveSharePage() {
  // Checked here as well as in the layout, which Next.js may not re-render on
  // every navigation.
  if (!(await getCurrentResearcher())) redirect("/admin");

  // The same read-only loader as the development page (DL-079).
  const [students, lessonOneCodes] = await Promise.all([
    loadStudentDevelopment(),
    loadLessonOneCodes(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 p-5 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold">
          Andel passiva koder i gruppen
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Andelen P-koder av alla P-, A- och C-koder i AI-kodningen, per lektion
          och för pre-interaktion (lektion 1 och 2) och post-interaktion
          (lektion 3 och 4). En prompt kodad P och C räknas som en P och en C,
          och NA räknas inte. Sidan visar bara lagrad kodning och ändrar
          ingenting.
        </p>
      </div>
      <LessonOneCodesNotice state={lessonOneCodes} />
      <PassiveShareView students={students} />
    </main>
  );
}
