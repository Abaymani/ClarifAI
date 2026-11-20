"use client";

import { useState } from "react";

import { ReflectionOverview } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/reflection-overview";
import { TranscriptWorkspace } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/transcript-workspace";
import type { ResearcherId } from "@/lib/admin/auth";
import type {
  AdminCodeOption,
  ReflectionCommentsByResearcher,
  ResearcherCoding,
} from "@/lib/admin/types";
import type {
  StoredCoding,
  StoredReflectionQuestions,
} from "@/lib/analysis/types";
import type { TranscriptMessage } from "@/lib/scraping/transcript";
import type { StoredReflectionResponses } from "@/lib/session/types";

type View = "transcript" | "reflection";

export function SessionWorkspace({
  sessionId,
  participantCode,
  messages,
  analysis,
  coding,
  currentResearcher,
  codeOptions,
  reflectionQuestions,
  reflectionResponses,
  reflectionComments,
  transcriptEmptyText,
  initialView = "transcript",
  showReflection = true,
}: {
  sessionId: string;
  participantCode: string;
  messages: TranscriptMessage[];
  analysis: StoredCoding | null;
  coding: Record<ResearcherId, ResearcherCoding[]>;
  currentResearcher: ResearcherId;
  codeOptions: AdminCodeOption[];
  reflectionQuestions: StoredReflectionQuestions | null;
  reflectionResponses: StoredReflectionResponses | null;
  reflectionComments: ReflectionCommentsByResearcher;
  transcriptEmptyText: string | null;
  initialView?: View;
  showReflection?: boolean;
}) {
  const [view, setView] = useState<View>(initialView);
  const reflectionCount = reflectionQuestions?.items.length ?? 0;
  const transcript = transcriptEmptyText ? (
    <EmptyState text={transcriptEmptyText} />
  ) : (
    <TranscriptWorkspace
      sessionId={sessionId}
      participantCode={participantCode}
      messages={messages}
      analysis={analysis}
      coding={coding}
      currentResearcher={currentResearcher}
      codeOptions={codeOptions}
    />
  );

  // Without a reflection to review, a single tab would only add noise.
  if (!showReflection) return <section>{transcript}</section>;

  return (
    <section>
      <div
        className="mb-4 inline-grid grid-cols-2 rounded-lg bg-muted p-1 text-sm"
        role="tablist"
        aria-label="Sessionsvy"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "transcript"}
          aria-controls="transcript-panel"
          onClick={() => setView("transcript")}
          className={`rounded-md px-3 py-2 font-medium ${
            view === "transcript"
              ? "bg-background shadow-xs"
              : "text-muted-foreground"
          }`}
        >
          Transkript och kodning
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "reflection"}
          aria-controls="reflection-panel"
          onClick={() => setView("reflection")}
          className={`rounded-md px-3 py-2 font-medium ${
            view === "reflection"
              ? "bg-background shadow-xs"
              : "text-muted-foreground"
          }`}
        >
          Reflektion{reflectionCount > 0 ? ` · ${reflectionCount}` : ""}
        </button>
      </div>

      <div id="transcript-panel" role="tabpanel" hidden={view !== "transcript"}>
        {transcript}
      </div>

      <div id="reflection-panel" role="tabpanel" hidden={view !== "reflection"}>
        <ReflectionOverview
          sessionId={sessionId}
          questions={reflectionQuestions}
          responses={reflectionResponses}
          messages={messages}
          coding={coding}
          comments={reflectionComments}
          currentResearcher={currentResearcher}
        />
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-background px-6 py-16 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
