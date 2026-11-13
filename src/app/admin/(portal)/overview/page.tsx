import { LessonOneCodesNotice } from "@/app/admin/(portal)/lesson-one-codes-notice";
import { OverviewTable } from "@/app/admin/(portal)/overview/overview-table";
import { ResearchDataFreshness } from "@/app/admin/(portal)/research-data-freshness";
import {
  cachedAdminOverview,
  formatFetchedAt,
} from "@/lib/admin/cached-research-data";
import { loadLessonOneCodes } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [overview, lessonOneCodes] = await Promise.all([
    cachedAdminOverview(),
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
      <ResearchDataFreshness fetchedAt={formatFetchedAt(overview.fetchedAt)} />
      <LessonOneCodesNotice state={lessonOneCodes} />
      <OverviewTable participants={overview.data} />
    </main>
  );
}
