"use client";

import { useState, useTransition } from "react";

import {
  CodingSourceBadge,
  type CodingSourceBadgeData,
} from "@/app/admin/(portal)/coding-source-badge";
import { saveReflectionCommentAction } from "@/app/admin/(portal)/reflection-actions";
import { MessageContent } from "@/app/session/message-content";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResearcherId } from "@/lib/admin/auth";
import { researcherName } from "@/lib/admin/researchers";
import type {
  ReflectionCommentsByResearcher,
  ResearcherCoding,
  ResearcherReflectionComment,
} from "@/lib/admin/types";
import { MAX_REFLECTION_COMMENT_LENGTH } from "@/lib/admin/types";
import type {
  ReflectionItem,
  StoredReflectionQuestions,
} from "@/lib/analysis/types";
import type { TranscriptMessage } from "@/lib/scraping/transcript";
import type {
  AnalysisAgreement,
  StoredReflectionResponses,
} from "@/lib/session/types";

type CodingByResearcher = Record<ResearcherId, ResearcherCoding[]>;

export function ReflectionOverview({
  sessionId,
  questions,
  responses,
  messages,
  coding,
  comments,
  currentResearcher,
}: {
  sessionId: string;
  questions: StoredReflectionQuestions | null;
  responses: StoredReflectionResponses | null;
  messages: TranscriptMessage[];
  coding: CodingByResearcher;
  comments: ReflectionCommentsByResearcher;
  currentResearcher: ResearcherId;
}) {
  if (!questions) {
    return (
      <EmptyState text="Det finns inga lagrade reflektionsfrågor för lektionen." />
    );
  }

  const responseByItem = new Map(
    responses?.items.map((response) => [response.itemId, response]) ?? [],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Studentens reflektion</h2>
          <p className="text-xs text-muted-foreground">
            {responses
              ? `${questions.items.length} reflektionsmoment · inskickad reflektion`
              : `${questions.items.length} reflektionsmoment · ännu inte inskickad`}
          </p>
        </div>
      </div>

      {questions.items.map((item, index) => {
        const response = responseByItem.get(item.id) ?? null;
        const fullMessage = item.excerpt
          ? (messages.find(
              (message) =>
                message.index === item.excerpt?.message &&
                message.role === "student",
            ) ?? null)
          : null;
        const badges = codingBadges(item, coding);

        return (
          <article
            key={item.id}
            className="overflow-hidden rounded-xl border bg-background"
          >
            <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {item.excerpt
                    ? `Meddelande ${item.excerpt.message}`
                    : "Allmän reflektion"}{" "}
                  · {item.group}
                </p>
                <h2 className="mt-0.5 font-semibold">
                  Reflektionsmoment {index + 1}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {item.basedOn ? (
                  <AgreementBadge agreement={response?.agreement ?? null} />
                ) : null}
                {badges.map((badge) => (
                  <CodingSourceBadge
                    key={`${badge.source}-${badge.code}`}
                    {...badge}
                  />
                ))}
              </div>
            </header>

            <div className="grid xl:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
              <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
                {item.excerpt ? (
                  <section>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Utdrag ur studentens prompt · meddelande{" "}
                      {item.excerpt.message}
                    </p>
                    <blockquote className="rounded-lg border-l-4 bg-muted/35 px-4 py-3 text-sm">
                      <p className="whitespace-pre-wrap">
                        {compactExcerpt(item.excerpt.text)}
                      </p>
                    </blockquote>
                    {fullMessage ? (
                      <details className="group mt-2">
                        <summary className="w-fit cursor-pointer text-xs font-medium underline-offset-2 hover:underline">
                          <span className="group-open:hidden">
                            Visa hela meddelandet
                          </span>
                          <span className="hidden group-open:inline">
                            Dölj hela meddelandet
                          </span>
                        </summary>
                        <div className="mt-2 rounded-lg bg-muted p-3 text-sm">
                          <MessageContent text={fullMessage.text} />
                        </div>
                      </details>
                    ) : null}
                  </section>
                ) : null}

                {item.basedOn ? (
                  <section>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Analysen studenten fick
                    </p>
                    <p className="border-l-2 pl-3 text-sm">{item.intro}</p>
                  </section>
                ) : null}

                <section>
                  <h3 className="text-sm font-semibold">Reflektionsfrågor</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {item.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Studentens svar
                  </p>
                  <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
                    {response?.answer ||
                      "Reflektionen har inte skickats in ännu."}
                  </div>
                </section>
              </div>

              <ReflectionCommentPanel
                sessionId={sessionId}
                itemId={item.id}
                comments={{
                  R1:
                    comments.R1.find((comment) => comment.itemId === item.id) ??
                    null,
                  R2:
                    comments.R2.find((comment) => comment.itemId === item.id) ??
                    null,
                }}
                currentResearcher={currentResearcher}
              />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function AgreementBadge({
  agreement,
}: {
  agreement: AnalysisAgreement | null;
}) {
  const label =
    agreement === "yes"
      ? "Ja"
      : agreement === "partly"
        ? "Delvis"
        : agreement === "no"
          ? "Nej"
          : "Ej besvarad";
  const tone =
    agreement === "yes"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : agreement === "partly"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        : agreement === "no"
          ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function codingBadges(
  item: ReflectionItem,
  coding: CodingByResearcher,
): CodingSourceBadgeData[] {
  if (!item.basedOn) return [];
  const badges: CodingSourceBadgeData[] = [
    { source: "ai", label: "AI", code: item.basedOn.code },
  ];
  for (const researcherId of ["R1", "R2"] as const) {
    for (const entry of coding[researcherId]) {
      const related =
        item.basedOn.kind === "prompt"
          ? entry.kind === "prompt" &&
            entry.message === item.basedOn.firstMessage
          : entry.kind === "sequence" &&
            entry.firstMessage === item.basedOn.firstMessage &&
            entry.lastMessage === item.basedOn.lastMessage;
      if (!related) continue;
      badges.push(
        ...entry.codes.map((code) => ({
          source: researcherId,
          label: researcherName(researcherId),
          code,
        })),
      );
    }
  }
  return badges;
}

function compactExcerpt(text: string, maxLength = 240): string {
  const normalized = text.trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}…`
    : normalized;
}

function ReflectionCommentPanel({
  sessionId,
  itemId,
  comments: initialComments,
  currentResearcher,
}: {
  sessionId: string;
  itemId: string;
  comments: Record<ResearcherId, ResearcherReflectionComment | null>;
  currentResearcher: ResearcherId;
}) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState(
    initialComments[currentResearcher]?.comment ?? "",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setStatus(null);
    startTransition(async () => {
      const result = await saveReflectionCommentAction({
        sessionId,
        itemId,
        comment: draft,
      });
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      setComments((current) => ({
        ...current,
        [currentResearcher]: result.entry,
      }));
      setDraft(result.entry?.comment ?? "");
      setStatus("Sparat.");
    });
  }

  return (
    <aside className="border-t bg-muted/20 p-4 xl:border-t-0 xl:border-l">
      <h3 className="text-sm font-semibold">Forskarkommentarer</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Båda forskarnas kommentarer visas tillsammans.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {(["R1", "R2"] as const).map((researcherId) => (
          <div
            key={researcherId}
            className="rounded-lg border bg-background p-3"
          >
            <p className="text-xs font-semibold">
              {researcherName(researcherId)}
              {researcherId === currentResearcher ? " (du)" : ""}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
              {comments[researcherId]?.comment ?? "Ingen kommentar ännu."}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t pt-4">
        <Label htmlFor={`reflection-comment-${itemId}`}>
          Din kommentar · {researcherName(currentResearcher)}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Du kan bara skriva och ändra din egen kommentar.
        </p>
        <Textarea
          id={`reflection-comment-${itemId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_REFLECTION_COMMENT_LENGTH}
          placeholder="Skriv en kommentar om reflektionsmomentet…"
          className="mt-2 min-h-24 bg-background"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {status}
          </p>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Sparar…" : "Spara min kommentar"}
          </Button>
        </div>
      </div>
    </aside>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-background px-6 py-16 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
