"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Circle, FileX2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { ResearcherId } from "@/lib/admin/auth";
import { researcherName } from "@/lib/admin/researchers";
import type {
  AdminParticipantOverview,
  AdminSessionSummary,
} from "@/lib/admin/types";
import { LESSONS } from "@/lib/session/credentials";

type OverviewView = "status" | "coding";

export function OverviewTable({
  participants,
}: {
  participants: AdminParticipantOverview[];
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<OverviewView>("status");
  const [hideWithoutSessions, setHideWithoutSessions] = useState(false);
  const visible = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return participants.filter((participant) => {
      const matchesQuery =
        !normalised ||
        participant.participantCode.toLowerCase().includes(normalised);
      const hasAnySession = LESSONS.some(
        (lesson) => participant.sessions[lesson] !== undefined,
      );
      return matchesQuery && (!hideWithoutSessions || hasAnySession);
    });
  }, [hideWithoutSessions, participants, query]);

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Välj översikt"
        className="flex w-fit rounded-lg bg-muted p-1"
      >
        <OverviewTab
          view="status"
          selected={view === "status"}
          onSelect={setView}
        >
          Sessionsstatus
        </OverviewTab>
        <OverviewTab
          view="coding"
          selected={view === "coding"}
          onSelect={setView}
        >
          Forskarkodning
        </OverviewTab>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">Sök deltagarkod</span>
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök deltagarkod"
            className="h-10 pl-9"
          />
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-background px-3 py-2">
          <input
            type="checkbox"
            checked={hideWithoutSessions}
            onChange={(event) => setHideWithoutSessions(event.target.checked)}
            className="mt-0.5 size-4 accent-foreground"
          />
          <span>
            <span className="block text-sm font-medium">
              Dölj deltagare utan aktivitet
            </span>
            <span className="block text-xs text-muted-foreground">
              Endast när alla fyra lektioner saknar session
            </span>
          </span>
        </label>
      </div>

      {view === "coding" ? (
        <p className="text-sm text-muted-foreground">
          Kodad betyder att forskaren har sparat minst en anteckning eller kod
          för lektionen.
        </p>
      ) : null}

      <div
        role="tabpanel"
        aria-label={view === "status" ? "Sessionsstatus" : "Forskarkodning"}
        className="overflow-x-auto rounded-xl border bg-background"
      >
        <table className="w-full min-w-5xl border-collapse text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 font-semibold">Deltagare</th>
              {LESSONS.map((lesson) => (
                <th key={lesson} className="px-4 py-3 font-semibold">
                  Lektion {lesson}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((participant) => (
              <tr
                key={participant.participantCode}
                className="border-b last:border-0"
              >
                <th className="px-4 py-3 font-semibold whitespace-nowrap">
                  Deltagare {participant.participantCode}
                </th>
                {LESSONS.map((lesson) => {
                  const session = participant.sessions[lesson];
                  const state = session?.state ?? "missing";
                  return (
                    <td key={lesson} className="p-2 align-top">
                      <Link
                        href={`/admin/participant/${participant.participantCode}/lesson/${lesson}`}
                        className="block min-w-44 rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
                        title={session?.status}
                      >
                        {view === "status" ? (
                          <StatusBadge state={state} />
                        ) : (
                          <CodingCoverage session={session} />
                        )}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {hideWithoutSessions && !query.trim()
              ? "Inga deltagare med aktivitet att visa."
              : "Ingen deltagarkod matchar sökningen."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OverviewTab({
  view,
  selected,
  onSelect,
  children,
}: {
  view: OverviewView;
  selected: boolean;
  onSelect: (view: OverviewView) => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(view)}
      className={`rounded-md px-4 py-2 text-sm font-medium ${selected ? "bg-background shadow-xs" : "text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  state,
}: {
  state: "started" | "completed" | "missing";
}) {
  const label = {
    started: "Påbörjad",
    completed: "Slutförd",
    missing: "Saknas",
  }[state];
  const style = {
    started:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    completed:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    missing: "bg-muted text-muted-foreground",
  }[state];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${style}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function CodingCoverage({
  session,
}: {
  session: AdminSessionSummary | undefined;
}) {
  if (!session || session.transcriptSubmission !== "transcript") {
    return (
      <span className="flex min-h-16 items-center justify-center gap-2 rounded-md bg-muted/60 px-2 text-xs text-muted-foreground">
        <FileX2 aria-hidden="true" className="size-4" />
        Inget transkript
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-1.5">
      {(["R1", "R2"] as const).map((researcherId) => (
        <ResearcherCoverage
          key={researcherId}
          researcherId={researcherId}
          coded={session.codedBy.includes(researcherId)}
        />
      ))}
    </span>
  );
}

function ResearcherCoverage({
  researcherId,
  coded,
}: {
  researcherId: ResearcherId;
  coded: boolean;
}) {
  const researcherStyle =
    researcherId === "R1"
      ? "bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
      : "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200";
  return (
    <span className="flex items-center justify-between gap-3 rounded-md border px-2 py-1.5">
      <span className="flex items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className={`flex size-6 items-center justify-center rounded-full text-xs ${researcherStyle}`}
        >
          {researcherName(researcherId).slice(0, 1)}
        </span>
        {researcherName(researcherId)}
      </span>
      <span
        className={`flex items-center gap-1 text-xs ${coded ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}
      >
        {coded ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Circle aria-hidden="true" className="size-3.5" />
        )}
        {coded ? "Kodad" : "Ej kodad"}
      </span>
    </span>
  );
}
