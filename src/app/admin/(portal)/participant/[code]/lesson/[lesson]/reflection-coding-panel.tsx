"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";

import { saveReflectionCodingAction } from "@/app/admin/(portal)/reflection-actions";
import { Button } from "@/components/ui/button";
import type { ResearcherId } from "@/lib/admin/auth";
import {
  maxReflectionScore,
  reflectionScore,
  type ReflectionCodingFramework,
} from "@/lib/admin/reflection-coding";
import { researcherName } from "@/lib/admin/researchers";
import type { ResearcherReflectionCoding } from "@/lib/admin/types";

type OwnCoding = { criteria: string[]; coded: boolean };

export function ReflectionCodingPanel({
  sessionId,
  itemId,
  framework,
  coding,
  currentResearcher,
  submitted,
}: {
  sessionId: string;
  itemId: string;
  framework: ReflectionCodingFramework;
  coding: Record<ResearcherId, ResearcherReflectionCoding | null>;
  currentResearcher: ResearcherId;
  submitted: boolean;
}) {
  const [own, setOwn] = useState<OwnCoding>({
    criteria: coding[currentResearcher]?.criteria ?? [],
    coded: coding[currentResearcher]?.coded ?? false,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  // Saves run one after another, so the last change made is the one stored.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const other: ResearcherId = currentResearcher === "R1" ? "R2" : "R1";
  const otherCoding = coding[other];
  const max = maxReflectionScore(framework);
  const total = reflectionScore(own.criteria, framework);
  const idPrefix = `reflection-coding-${itemId}`;

  function save(next: OwnCoding) {
    setOwn(next);
    setStatus(null);
    setSaving((count) => count + 1);
    queue.current = queue.current.then(async () => {
      try {
        const result = await saveReflectionCodingAction({
          sessionId,
          itemId,
          criteria: next.criteria,
          coded: next.coded,
        });
        setStatus(result.ok ? "Sparat." : result.error);
      } catch {
        setStatus("Reflektionskodningen kunde inte sparas.");
      } finally {
        setSaving((count) => count - 1);
      }
    });
  }

  function toggleCriterion(id: string, checked: boolean) {
    save({
      ...own,
      criteria: checked
        ? [...own.criteria, id]
        : own.criteria.filter((criterion) => criterion !== id),
    });
  }

  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="border-b pb-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${idPrefix}-heading`} className="text-sm font-semibold">
          Reflektionskodning
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${own.coded ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "bg-muted text-muted-foreground"}`}
        >
          {researcherName(currentResearcher)} ·{" "}
          {own.coded ? "kodad" : "ej kodad"}
        </span>
      </div>

      {!submitted ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Reflektionen har inte skickats in, så momentet kan inte kodas.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Varje kriterium ger 1 poäng. Momentet räknas som kodat först när du
          markerar det.
        </p>
      )}

      <div className="mt-2 flex flex-col gap-2">
        {framework.states.map((state) => (
          <fieldset key={state.state} disabled={!submitted}>
            <legend className="text-xs font-semibold">
              State {state.state}
            </legend>
            {state.criteria.map((criterion) => {
              const inputId = `${idPrefix}-${criterion.id}`;
              return (
                <label
                  key={criterion.id}
                  htmlFor={inputId}
                  className="flex cursor-pointer items-start gap-2 py-0.5 text-sm has-disabled:cursor-not-allowed has-disabled:text-muted-foreground"
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={own.criteria.includes(criterion.id)}
                    onChange={(event) =>
                      toggleCriterion(criterion.id, event.target.checked)
                    }
                    className="mt-0.5 size-4 shrink-0 accent-foreground"
                  />
                  <span>{criterion.label}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-sm">
          Summa{" "}
          <span className="text-base font-semibold tabular-nums">{total}</span>/
          {max}
        </p>
        <Button
          type="button"
          size="sm"
          variant={own.coded ? "outline" : "default"}
          disabled={!submitted}
          onClick={() => save({ ...own, coded: !own.coded })}
        >
          {own.coded ? (
            <>
              <Check aria-hidden="true" />
              Kodad · ångra
            </>
          ) : (
            "Markera som kodad"
          )}
        </Button>
      </div>
      <p
        aria-live="polite"
        className="mt-1 min-h-4 text-xs text-muted-foreground"
      >
        {saving > 0 ? "Sparar…" : status}
      </p>

      <p className="mt-2 text-xs text-muted-foreground">
        {researcherName(other)}:{" "}
        <span className="font-medium text-foreground">
          {!otherCoding
            ? "ingen kodning ännu"
            : `${reflectionScore(otherCoding.criteria, framework)}/${max} · ${otherCoding.coded ? "kodad" : "ej kodad"}`}
        </span>
      </p>
    </section>
  );
}
