import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { TranscriptWorkspace } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/transcript-workspace";
import { Button } from "@/components/ui/button";
import { adminCodeOptions } from "@/lib/admin/codes";
import { getCurrentResearcher } from "@/lib/admin/auth";
import { getAdminSession, listResearcherCoding } from "@/lib/admin/store";
import { loadFramework } from "@/lib/analysis/framework";
import { LESSONS, type Lesson } from "@/lib/session/credentials";

export const dynamic = "force-dynamic";

export default async function AdminTranscriptPage({
  params,
}: PageProps<"/admin/participant/[code]/lesson/[lesson]">) {
  const { code, lesson: lessonText } = await params;
  const lesson = Number(lessonText) as Lesson;
  if (!/^\d{1,3}$/.test(code) || !LESSONS.includes(lesson)) notFound();

  const researcher = await getCurrentResearcher();
  if (!researcher) notFound();

  const session = await getAdminSession(code, lesson);
  const [coding, codeOptions] = session
    ? await Promise.all([
        listResearcherCoding(session.id),
        Promise.resolve(adminCodeOptions(loadFramework())),
      ])
    : [{ R1: [], R2: [] }, adminCodeOptions(loadFramework())];
  const previous = lesson > 1 ? ((lesson - 1) as Lesson) : null;
  const next = lesson < 4 ? ((lesson + 1) as Lesson) : null;

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-5 p-5 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/admin/overview"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Översikt
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">Deltagare {code}</p>
          <h1 className="font-heading text-3xl font-semibold">
            Lektion {lesson}
          </h1>
        </div>
        <div className="flex gap-2">
          {previous ? (
            <Button
              variant="outline"
              render={
                <Link href={`/admin/participant/${code}/lesson/${previous}`} />
              }
            >
              <ChevronLeft aria-hidden="true" />
              Föregående lektion
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <ChevronLeft aria-hidden="true" />
              Föregående lektion
            </Button>
          )}
          {next ? (
            <Button
              render={
                <Link href={`/admin/participant/${code}/lesson/${next}`} />
              }
            >
              Nästa lektion
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : (
            <Button disabled>
              Nästa lektion
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {!session ? (
        <EmptyState text="Deltagaren har inte startat den här lektionen." />
      ) : session.transcriptSubmission === "no_gemini" ? (
        <EmptyState text="Deltagaren uppgav att Gemini inte användes under den här lektionen." />
      ) : !session.transcript ? (
        <EmptyState text="Lektionen är påbörjad men har inget sparat transkript ännu." />
      ) : (
        <TranscriptWorkspace
          sessionId={session.id}
          messages={session.transcript.messages}
          analysis={session.analysis}
          coding={coding}
          currentResearcher={researcher.id}
          codeOptions={codeOptions}
        />
      )}
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-background px-6 py-16 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
