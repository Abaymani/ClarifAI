"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AdminParticipantOverview } from "@/lib/admin/types";
import { LESSONS } from "@/lib/session/credentials";

export function OverviewTable({
  participants,
}: {
  participants: AdminParticipantOverview[];
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return normalised
      ? participants.filter((participant) =>
          participant.participantCode.toLowerCase().includes(normalised),
        )
      : participants;
  }, [participants, query]);

  return (
    <div className="flex flex-col gap-5">
      <label className="relative block max-w-sm">
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

      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full min-w-3xl border-collapse text-left text-sm">
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
                <th className="px-4 py-3 font-semibold">
                  Deltagare {participant.participantCode}
                </th>
                {LESSONS.map((lesson) => {
                  const session = participant.sessions[lesson];
                  const state = session?.state ?? "missing";
                  return (
                    <td key={lesson} className="p-2">
                      <Link
                        href={`/admin/participant/${participant.participantCode}/lesson/${lesson}`}
                        className="block rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
                        title={session?.status}
                      >
                        <StatusBadge state={state} />
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
            Ingen deltagarkod matchar sökningen.
          </p>
        ) : null}
      </div>
    </div>
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
