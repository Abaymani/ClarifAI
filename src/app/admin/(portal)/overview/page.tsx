import { LessonOneCodesNotice } from "@/app/admin/(portal)/lesson-one-codes-notice";
import { OverviewTable } from "@/app/admin/(portal)/overview/overview-table";
import { listAdminOverview, loadLessonOneCodes } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [participants, lessonOneCodes] = await Promise.all([
    listAdminOverview(),
    loadLessonOneCodes(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6 p-5 lg:p-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Översikt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Se sessionsstatus, forskarnas kodningsarbete, AI-kodningen eller
          studenternas bedömning per lektion.
        </p>
      </div>
      <LessonOneCodesNotice state={lessonOneCodes} />
      <OverviewTable participants={participants} />
    </main>
  );
}
