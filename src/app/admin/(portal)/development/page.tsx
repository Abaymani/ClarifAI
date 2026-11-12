import { redirect } from "next/navigation";

import { StudentDevelopmentView } from "@/app/admin/(portal)/development/student-development-view";
import { LessonOneCodesNotice } from "@/app/admin/(portal)/lesson-one-codes-notice";
import { getCurrentResearcher } from "@/lib/admin/auth";
import { loadLessonOneCodes, loadStudentDevelopment } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export default async function AdminDevelopmentPage() {
  // Checked here as well as in the layout, which Next.js may not re-render on
  // every navigation.
  if (!(await getCurrentResearcher())) redirect("/admin");

  const [students, lessonOneCodes] = await Promise.all([
    loadStudentDevelopment(),
    loadLessonOneCodes(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 p-5 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Utveckling</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Hur varje deltagares promptkoder fördelar sig på ICAP-nivåerna P, A
          och C från lektion 1 till 4, enligt AI:n, Armin eller Frida. Sidan
          visar bara lagrad kodning och ändrar ingenting.
        </p>
      </div>
      <LessonOneCodesNotice state={lessonOneCodes} />
      <StudentDevelopmentView students={students} />
    </main>
  );
}
