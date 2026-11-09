"use client";

import { useState, useTransition } from "react";
import { Calculator, Combine, Eraser, LoaderCircle, X } from "lucide-react";

import { tryFrameworkChangesAction } from "@/app/admin/(portal)/agreement-actions";
import {
  Uncertain,
  formatAlpha,
  formatChange,
  pairName,
  type AgreementCode,
} from "@/app/admin/(portal)/agreement/agreement-format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
  AgreementBase,
  Change,
  ChangeVariant,
  PairChange,
} from "@/lib/admin/coder-agreement";
import type { FrameworkChange } from "@/lib/admin/framework-changes";
import type { IcapLevel } from "@/lib/admin/icap-counts";
import type { Lesson } from "@/lib/session/credentials";

const LEVELS: [IcapLevel, string][] = [
  ["P", "Passiv"],
  ["A", "Aktiv"],
  ["C", "Konstruktiv"],
];

// Changes are only tried: the action reads the coding and calculates on a copy,
// and the result lives in this component until the page is left (DL-078).
export function FrameworkChangesPanel({
  codes,
  lesson,
  base,
}: {
  codes: AgreementCode[];
  lesson: Lesson | null;
  base: AgreementBase;
}) {
  const [changes, setChanges] = useState<FrameworkChange[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [chosenLevel, setChosenLevel] = useState<IcapLevel | null>(null);
  const [deletion, setDeletion] = useState("");
  const [variants, setVariants] = useState<ChangeVariant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const levelOf = new Map(codes.map((code) => [code.code, code.level]));
  const used = new Set(
    changes.flatMap((change) =>
      change.kind === "merge" ? change.codes : [change.code],
    ),
  );
  const selectedLevels = LEVELS.map(([level]) => level).filter((level) =>
    selected.some((code) => levelOf.get(code) === level),
  );
  const mergeLevel =
    selectedLevels.length === 1
      ? selectedLevels[0]
      : chosenLevel && selectedLevels.includes(chosenLevel)
        ? chosenLevel
        : null;
  const variant = variants?.find(
    (candidate) => candidate.lesson === lesson && candidate.base === base,
  );

  // A result only belongs to the changes it was calculated with.
  function change(next: FrameworkChange[]) {
    setChanges(next);
    setVariants(null);
    setError(null);
  }

  function addMerge() {
    if (selected.length < 2 || !mergeLevel) return;
    change([
      ...changes,
      {
        kind: "merge",
        codes: codes
          .map((code) => code.code)
          .filter((code) => selected.includes(code)),
        level: mergeLevel,
      },
    ]);
    setSelected([]);
    setChosenLevel(null);
  }

  function addDeletion() {
    if (!deletion) return;
    change([...changes, { kind: "delete", code: deletion }]);
    setDeletion("");
  }

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await tryFrameworkChangesAction(changes);
      if (result.ok) setVariants(result.variants);
      else setError(result.error);
    });
  }

  function describe(change: FrameworkChange): string {
    if (change.kind === "delete") return `Ta bort ${change.code}`;
    const spansLevels =
      new Set(change.codes.map((code) => levelOf.get(code))).size > 1;
    return `Slå ihop ${change.codes.join(" + ")}${spansLevels ? ` → nivå ${change.level}` : ""}`;
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border bg-background p-4"
      aria-labelledby="framework-changes"
    >
      <div>
        <h2 id="framework-changes" className="text-xl font-semibold">
          Prova ändringar i ramverket
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Räknas på en kopia i minnet med dagens kodning. Inget sparas och inget
          raderas: kodningen, ramverket och det sparade resultatet ändras inte.
          En borttagen kod räknas som om ingen hade gett den.
        </p>
      </div>

      {changes.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Ändringar">
          {changes.map((entry, index) => (
            <li
              key={describe(entry)}
              className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm"
            >
              {entry.kind === "merge" ? (
                <Combine aria-hidden="true" className="size-4" />
              ) : (
                <Eraser aria-hidden="true" className="size-4" />
              )}
              {describe(entry)}
              <button
                type="button"
                onClick={() => change(changes.filter((_, i) => i !== index))}
                aria-label={`Ta bort ändringen: ${describe(entry)}`}
                className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Inga ändringar än.</p>
      )}

      <details className="rounded-lg border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          Slå ihop koder
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          {LEVELS.map(([level, name]) => (
            <fieldset key={level}>
              <legend className="text-xs font-medium text-muted-foreground">
                {name}
              </legend>
              <div className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {codes
                  .filter((code) => code.level === level)
                  .map((code) => (
                    <label
                      key={code.code}
                      className="flex items-start gap-2 text-sm has-disabled:opacity-50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(code.code)}
                        disabled={used.has(code.code)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, code.code]
                              : current.filter((item) => item !== code.code),
                          )
                        }
                        className="mt-0.5 size-4 accent-foreground"
                      />
                      <span>
                        <span className="font-semibold">{code.code}</span>{" "}
                        <span className="text-muted-foreground">
                          {code.name}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {selectedLevels.length > 1 ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="merge-level" className="text-sm font-medium">
                  Nivå för den sammanslagna koden
                </label>
                <select
                  id="merge-level"
                  value={mergeLevel ?? ""}
                  onChange={(event) =>
                    setChosenLevel(
                      (event.target.value || null) as IcapLevel | null,
                    )
                  }
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">Välj nivå</option>
                  {LEVELS.filter(([level]) =>
                    selectedLevels.includes(level),
                  ).map(([level, name]) => (
                    <option key={level} value={level}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={addMerge}
              disabled={selected.length < 2 || !mergeLevel}
            >
              <Combine aria-hidden="true" />
              Lägg till sammanslagning
            </Button>
          </div>
        </div>
      </details>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="framework-delete" className="text-sm font-medium">
            Ta bort kod
          </label>
          <select
            id="framework-delete"
            value={deletion}
            onChange={(event) => setDeletion(event.target.value)}
            className="h-9 min-w-56 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">Välj kod</option>
            {codes
              .filter((code) => !used.has(code.code))
              .map((code) => (
                <option key={code.code} value={code.code}>
                  {code.code} {code.name}
                </option>
              ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addDeletion}
          disabled={!deletion}
        >
          <Eraser aria-hidden="true" />
          Lägg till borttagning
        </Button>
      </div>

      <div>
        <Button
          type="button"
          onClick={run}
          disabled={changes.length === 0 || pending}
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Calculator aria-hidden="true" />
          )}
          {pending ? "Räknar …" : "Räkna med ändringarna"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {variant ? <ChangeTable variant={variant} /> : null}
    </section>
  );
}

function ChangeTable({ variant }: { variant: ChangeVariant }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Följer filtren ovan:{" "}
        {variant.lesson === null
          ? "alla lektioner"
          : `lektion ${variant.lesson}`}
        ,{" "}
        {variant.base === "pair"
          ? "alla som båda i paret kodat"
          : "bara de som alla tre kodat"}
        . Före räknas från dagens kodning och kan skilja sig från korten ovan om
        någon har kodat sedan senaste beräkningen.
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-3xl border-collapse text-left text-sm">
          <caption className="sr-only">
            Överensstämmelse före och efter ändringarna
          </caption>
          <thead>
            <tr className="border-b bg-muted/40">
              <th scope="col" className="px-4 py-3 font-semibold">
                Par
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Promptkoder: före → efter
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                ICAP-nivåer: före → efter
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Berörda prompter
              </th>
            </tr>
          </thead>
          <tbody>
            {variant.pairs.map((pair) => (
              <tr key={pair.pair} className="border-b last:border-0">
                <th
                  scope="row"
                  className="px-4 py-2 align-top font-semibold whitespace-nowrap"
                >
                  {pairName(pair.pair)}
                </th>
                <ChangeCell pair={pair} change={pair.codes} />
                <ChangeCell pair={pair} change={pair.levels} />
                <td className="px-4 py-2 align-top tabular-nums">
                  {pair.prompts === 0
                    ? "Inga transkript"
                    : `${pair.affected} av ${pair.prompts}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChangeCell({ pair, change }: { pair: PairChange; change: Change }) {
  if (pair.prompts === 0) {
    return <td className="px-4 py-2 align-top text-muted-foreground">–</td>;
  }
  return (
    <td className="px-4 py-2 align-top">
      <span className="font-semibold tabular-nums">
        {formatAlpha(change.before)} → {formatAlpha(change.after)}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
        {formatChange(change.difference)}
        <Uncertain transcripts={pair.transcripts} />
      </span>
    </td>
  );
}
