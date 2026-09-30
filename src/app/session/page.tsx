import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions";
import { AnalysisPending } from "@/app/session/analysis-pending";
import { AnalysisRetry } from "@/app/session/analysis-retry";
import { NoGeminiConfirmation } from "@/app/session/no-gemini-confirmation";
import { ReflectionQuestions } from "@/app/session/reflection-questions";
import { TranscriptForm } from "@/app/session/transcript-form";
import { TranscriptPreview } from "@/app/session/transcript-preview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { INTERRUPTED_ANALYSIS, UNREADABLE_RESULT } from "@/lib/analysis/errors";
import type { StoredReflectionQuestions } from "@/lib/analysis/types";
import { reflectionDraftKey } from "@/lib/session/reflection-drafts";
import { SESSION_COOKIE } from "@/lib/session/session-token";
import { getSessionByToken } from "@/lib/session/store";
import {
  analysisInterrupted,
  analysisResultMissing,
  type Session,
} from "@/lib/session/types";
import { sv } from "@/lib/sv";

// Server Actions on this page start the analysis, which keeps running after the
// response (see `after` in actions.ts). Five minutes is the Vercel Hobby maximum.
export const maxDuration = 300;

type View =
  | { kind: "transcript" }
  | { kind: "preview" }
  | { kind: "analysing" }
  | { kind: "analysisFailed"; errorCode: string }
  | {
      kind: "reflection";
      questions: StoredReflectionQuestions;
      draftKey: string;
    }
  | { kind: "noGeminiConfirmation" }
  | { kind: "confirmed" };

function viewFor(session: Session, now: Date): View {
  if (session.status === "awaiting_no_gemini_confirmation") {
    return { kind: "noGeminiConfirmation" };
  }
  if (session.status === "awaiting_reflection" && session.reflectionQuestions) {
    return {
      kind: "reflection",
      questions: session.reflectionQuestions,
      draftKey: reflectionDraftKey(
        session.id,
        session.reflectionQuestions.createdAt,
      ),
    };
  }
  if (!session.transcriptConfirmedAt) {
    return session.status === "awaiting_confirmation" && session.transcript
      ? { kind: "preview" }
      : { kind: "transcript" };
  }
  if (analysisResultMissing(session)) {
    return { kind: "analysisFailed", errorCode: UNREADABLE_RESULT };
  }
  if (session.status === "failed") {
    return {
      kind: "analysisFailed",
      errorCode: session.errorCode ?? "S2-UNEXPECTED",
    };
  }
  if (session.status === "processing") {
    return analysisInterrupted(session, now)
      ? { kind: "analysisFailed", errorCode: INTERRUPTED_ANALYSIS }
      : { kind: "analysing" };
  }
  return { kind: "confirmed" };
}

function analysisFailureMessage(errorCode: string): string {
  if (errorCode === INTERRUPTED_ANALYSIS) {
    return sv.errors.analysisInterrupted(errorCode);
  }
  if (errorCode === "S2-TOO-LONG") return sv.errors.analysisTooLong(errorCode);
  if (["S2-CONFIG", "S2-FRAMEWORK", "S2-TEST-FRAMEWORK"].includes(errorCode)) {
    return sv.errors.analysisUnavailable(errorCode);
  }
  return sv.errors.analysisFailed(errorCode);
}

export default async function SessionPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/");

  const session = await getSessionByToken(token);
  if (!session) redirect("/");
  if (session.status === "completed") redirect("/");

  const view = viewFor(session, new Date());
  const header = {
    transcript: {
      status:
        session.status === "processing"
          ? sv.session.statusProcessing
          : sv.session.statusAwaitingTranscript,
      heading: sv.session.heading,
      intro: sv.session.intro,
    },
    preview: {
      status: sv.session.statusAwaitingConfirmation,
      heading: sv.session.heading,
      intro: sv.session.introConfirmation,
    },
    analysing: {
      status: sv.session.statusAnalysing,
      heading: sv.session.analysingHeading,
      intro: sv.session.analysingIntro,
    },
    analysisFailed: {
      status: sv.session.statusAnalysisFailed,
      heading: sv.session.analysisFailedHeading,
      intro: sv.session.analysisFailedIntro,
    },
    reflection: {
      status: sv.session.statusAwaitingReflection,
      heading: sv.session.reflectionHeading,
      intro:
        view.kind === "reflection"
          ? view.questions.outcome === "insufficient_evidence"
            ? sv.session.reflectionIntroGeneral
            : view.questions.outcome === "no_transcript"
              ? sv.session.reflectionIntroNoGemini
              : sv.session.reflectionIntro
          : sv.session.reflectionIntro,
    },
    noGeminiConfirmation: {
      status: sv.session.statusNoGeminiConfirmation,
      heading: sv.session.noGeminiConfirmationHeading,
      intro: sv.session.noGeminiConfirmationIntro,
    },
    confirmed: {
      status: sv.session.statusTranscriptConfirmed,
      heading: sv.session.confirmedHeading,
      intro: sv.session.confirmedIntro,
    },
  }[view.kind];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {sv.session.participant(session.participantCode, session.lesson)}
        </span>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            {sv.session.logout}
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {header.status}
          </span>
          <h1 className="font-heading text-2xl leading-snug font-medium">
            {header.heading}
          </h1>
          <CardDescription>{header.intro}</CardDescription>
        </CardHeader>
        <CardContent>
          {view.kind === "preview" ? (
            <TranscriptPreview transcript={session.transcript!} />
          ) : view.kind === "transcript" ? (
            <div className="flex flex-col gap-4 rounded-xl border p-5">
              <h2 className="text-sm font-medium">
                {sv.session.transcriptHeading}
              </h2>
              <TranscriptForm
                lesson={session.lesson}
                initialError={
                  session.errorCode
                    ? sv.errors.transcriptRetry(session.errorCode)
                    : null
                }
              />
            </div>
          ) : view.kind === "analysing" ? (
            <AnalysisPending />
          ) : view.kind === "analysisFailed" ? (
            <AnalysisRetry failure={analysisFailureMessage(view.errorCode)} />
          ) : view.kind === "reflection" ? (
            <ReflectionQuestions
              // New questions start from an empty form, also without a reload.
              key={view.draftKey}
              draftKey={view.draftKey}
              questions={view.questions}
              messages={session.transcript?.messages ?? []}
            />
          ) : view.kind === "noGeminiConfirmation" ? (
            <NoGeminiConfirmation />
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
