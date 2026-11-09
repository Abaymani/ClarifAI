"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, LoaderCircle, RefreshCw } from "lucide-react";

import { runCoderAgreementAction } from "@/app/admin/(portal)/agreement-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type {
  AgreementBase,
  AgreementTranscript,
  CategoryAgreement,
  Coder,
  CoderPair,
  Difference,
  Interval,
  PairAgreement,
  SetAgreement,
  StoredCoderAgreement,
} from "@/lib/admin/coder-agreement";
import type { IcapLevel } from "@/lib/admin/icap-counts";
import { researcherName } from "@/lib/admin/researchers";
import { LESSONS, type Lesson } from "@/lib/session/credentials";

export type AgreementCode = { code: string; name: string; level: IcapLevel };

const PAIR_CODERS: Record<CoderPair, [Coder, Coder]> = {
  "R1-R2": ["R1", "R2"],
  "AI-R1": ["AI", "R1"],
  "AI-R2": ["AI", "R2"],
};
const LEVEL_NAMES: [IcapLevel, string][] = [
  ["P", "Passiv"],
  ["A", "Aktiv"],
  ["C", "Konstruktiv"],
];
const ALPHA = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const MEAN = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const DIFFERENCE = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});
// Intervals from fewer transcripts are shown but marked as unreliable (DL-077).
const UNCERTAIN_BELOW = 10;
const UNCERTAIN_STYLE =
  "rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";

export function CoderAgreementView({
  agreement,
  calculatedAt,
  codes,
  studyCodes,
}: {
  agreement: StoredCoderAgreement | null;
  calculatedAt: string | null;
  codes: AgreementCode[];
  // Session id → the participant code the portal shows it under (DL-072).
  studyCodes: Record<string, string>;
}) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [base, setBase] = useState<AgreementBase>("pair");
  const variant = agreement?.variants.find(
    (candidate) => candidate.lesson === lesson && candidate.base === base,
  );

  return (
    <div className="flex flex-col gap-6">
      <RunPanel agreement={agreement} calculatedAt={calculatedAt} />
      <Method />

      {agreement && variant ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="agreement-lesson" className="text-sm font-medium">
                Lektion
              </label>
              <select
                id="agreement-lesson"
                value={lesson ?? "all"}
                onChange={(event) =>
                  setLesson(
                    event.target.value === "all"
                      ? null
                      : (Number(event.target.value) as Lesson),
                  )
                }
                className="h-10 min-w-44 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="all">Alla lektioner</option>
                {LESSONS.map((option) => (
                  <option key={option} value={option}>
                    Lektion {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="agreement-base" className="text-sm font-medium">
                Transkript som jämförs
              </label>
              <select
                id="agreement-base"
                value={base}
                onChange={(event) =>
                  setBase(event.target.value as AgreementBase)
                }
                className="h-10 min-w-72 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="pair">Alla som båda i paret kodat</option>
                <option value="allThree">Bara de som alla tre kodat</option>
              </select>
            </div>
          </div>

          <section
            className="flex flex-col gap-3"
            aria-labelledby="agreement-codes"
          >
            <h2 id="agreement-codes" className="text-xl font-semibold">
              Promptkoder
            </h2>
            <PairCards pairs={variant.pairs} kind="codes" base={base} />
            <CategoryTable
              label="Överensstämmelse per kod"
              heading="Kod"
              pairs={variant.pairs}
              groups={LEVEL_NAMES.map(([level, levelName]) => ({
                label: levelName,
                rows: codes
                  .filter((code) => code.level === level)
                  .map((code) => ({
                    category: code.code,
                    label: code.code,
                    detail: code.name,
                  })),
              }))}
              categories={(pair) => pair.perCode}
            />
          </section>

          <section
            className="flex flex-col gap-3"
            aria-labelledby="agreement-levels"
          >
            <h2 id="agreement-levels" className="text-xl font-semibold">
              ICAP-nivåer
            </h2>
            <PairCards pairs={variant.pairs} kind="levels" base={base} />
            <CategoryTable
              label="Överensstämmelse per ICAP-nivå"
              heading="Nivå"
              pairs={variant.pairs}
              groups={[
                {
                  label: null,
                  rows: LEVEL_NAMES.map(([level, levelName]) => ({
                    category: level,
                    label: levelName,
                    detail: null,
                  })),
                },
              ]}
              categories={(pair) => pair.perLevel}
            />
          </section>

          <section
            className="flex flex-col gap-3"
            aria-labelledby="agreement-transcripts"
          >
            <h2 id="agreement-transcripts" className="text-xl font-semibold">
              Transkript
            </h2>
            <TranscriptTable
              transcripts={agreement.transcripts.filter(
                (row) =>
                  (lesson === null || row.lesson === lesson) &&
                  (base === "pair" || row.coders.length === 3),
              )}
              studyCodes={studyCodes}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function RunPanel({
  agreement,
  calculatedAt,
}: {
  agreement: StoredCoderAgreement | null;
  calculatedAt: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await runCoderAgreementAction();
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  const coded = (coder: Coder) =>
    agreement?.transcripts.filter((row) => row.coders.includes(coder)).length ??
    0;

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            {agreement && calculatedAt
              ? `Beräknad ${calculatedAt} av ${researcherName(agreement.calculatedBy)}`
              : "Inte beräknad än"}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {agreement
              ? `Kodade transkript: ${(["R1", "R2", "AI"] as const).map((coder) => `${coderName(coder)} ${coded(coder)}`).join(" · ")}. Ny kodning syns först när någon beräknar igen.`
              : "Beräkningen jämför Armins, Fridas och AI:ns promptkoder i alla kodade transkript. Resultatet sparas och visas för er båda."}
            {agreement && !agreement.bootstrap
              ? " Det här resultatet saknar intervall; beräkna igen för att få dem."
              : null}
          </p>
        </div>
        <Button type="button" onClick={run} disabled={pending}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : agreement ? (
            <RefreshCw aria-hidden="true" />
          ) : (
            <Calculator aria-hidden="true" />
          )}
          {pending ? "Beräknar …" : agreement ? "Beräkna igen" : "Beräkna"}
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

function Method() {
  return (
    <ul className="flex max-w-4xl list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
      <li>
        En kodare har kodat ett transkript när den har gett minst en prompt där
        en kod, NA-koder inräknade. Kodarens övriga prompter i transkriptet
        räknas då som att ingen kod passar.
      </li>
      <li>
        NA-koder jämförs inte och kodernas ordning spelar ingen roll. Prompter
        där ingen av de två har gett någon annan kod än NA räknas som överens.
      </li>
      <li>
        Kortens α jämför hela uppsättningen koder på varje prompt med
        MASI-avstånd, som ger delpoäng när uppsättningarna delvis överlappar. En
        prompt räknas på varje ICAP-nivå som den har en kod på.
      </li>
      <li>
        I tabellerna gäller α en kod eller nivå i taget: om prompten har den
        eller inte.
      </li>
      <li>
        KI är 95 % bootstrap-intervall: transkripten dras om 2 000 gånger med
        återläggning, så att prompter i samma transkript hålls ihop. Med färre
        än {UNCERTAIN_BELOW} transkript är intervallen osäkra och markeras så.
      </li>
      <li>
        Med ”Bara de som alla tre kodat” visar AI:ns kort skillnaden mot Armin –
        Frida. Ligger hela intervallet under 0 är AI:n tydligt mindre överens
        med er än ni är med varandra. Innehåller det 0 går skillnaden inte att
        avgöra med de här transkripten, vilket inte betyder att AI:n är lika
        bra.
      </li>
    </ul>
  );
}

function PairCards({
  pairs,
  kind,
  base,
}: {
  pairs: PairAgreement[];
  kind: "codes" | "levels";
  base: AgreementBase;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {pairs.map((pair) => {
        const [first, second] = PAIR_CODERS[pair.pair];
        const result: SetAgreement = pair[kind];
        const what = kind === "codes" ? "koder" : "nivåer";
        return (
          <section
            key={pair.pair}
            aria-label={pairName(pair.pair)}
            className="rounded-xl border bg-background p-4"
          >
            <h3 className="text-sm font-semibold">{pairName(pair.pair)}</h3>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              <span className="sr-only">Krippendorffs α: </span>
              {formatAlpha(result.alpha)}
            </p>
            {pair.prompts > 0 && result.interval !== undefined ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums">
                {formatInterval(result.interval, "95 % KI")}
                <Uncertain transcripts={pair.transcripts} long />
              </p>
            ) : null}
            {pair.versusResearchers ? (
              <p className="mt-2 text-sm tabular-nums">
                {formatDifference(pair.versusResearchers[kind])}
              </p>
            ) : null}
            {pair.prompts === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {base === "pair"
                  ? "Inga transkript som båda har kodat."
                  : "Inga transkript som alla tre har kodat."}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-0.5 text-sm text-muted-foreground">
                <li>
                  Samma {what} på{" "}
                  {Math.round((result.identical / pair.prompts) * 100)} % av
                  prompterna
                </li>
                <li>
                  {pair.transcripts} transkript · {pair.prompts} prompter
                </li>
                {kind === "codes" ? (
                  <li>
                    Utan kod hos båda: {pair.promptsWithoutCodes} prompter
                  </li>
                ) : null}
                <li>
                  {kind === "codes" ? "Koder" : "Nivåer"} per prompt:{" "}
                  {coderName(first)}{" "}
                  {MEAN.format(result.firstTotal / pair.prompts)} ·{" "}
                  {coderName(second)}{" "}
                  {MEAN.format(result.secondTotal / pair.prompts)}
                </li>
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

type CategoryGroup = {
  // Null for a table without groups.
  label: string | null;
  rows: { category: string; label: string; detail: string | null }[];
};

function CategoryTable({
  label,
  heading,
  pairs,
  groups,
  categories,
}: {
  label: string;
  heading: string;
  pairs: PairAgreement[];
  groups: CategoryGroup[];
  categories: (pair: PairAgreement) => CategoryAgreement[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-3xl border-collapse text-left text-sm">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="px-4 py-3 font-semibold">
              {heading}
            </th>
            {pairs.map((pair) => (
              <th
                key={pair.pair}
                scope="col"
                className="px-4 py-3 font-semibold"
              >
                {pairName(pair.pair)}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody
            key={group.label ?? "all"}
            className="last:[&>tr:last-child]:border-0"
          >
            {group.label ? (
              <tr className="border-b bg-muted/20">
                <th
                  scope="rowgroup"
                  colSpan={pairs.length + 1}
                  className="px-4 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {group.label}
                </th>
              </tr>
            ) : null}
            {group.rows.map((row) => (
              <tr key={row.category} className="border-b">
                <th scope="row" className="px-4 py-2 align-top font-semibold">
                  {row.label}
                  {row.detail ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.detail}
                    </span>
                  ) : null}
                </th>
                {pairs.map((pair) => (
                  <CategoryCell
                    key={pair.pair}
                    pair={pair}
                    result={categories(pair).find(
                      (candidate) => candidate.category === row.category,
                    )}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function CategoryCell({
  pair,
  result,
}: {
  pair: PairAgreement;
  result: CategoryAgreement | undefined;
}) {
  const [first, second] = PAIR_CODERS[pair.pair];
  const used =
    result !== undefined &&
    result.both + result.onlyFirst + result.onlySecond > 0;
  return (
    <td className="px-4 py-2 align-top">
      <span className="font-semibold tabular-nums">
        {formatAlpha(result?.alpha ?? null)}
      </span>
      {result?.interval !== undefined && pair.prompts > 0 ? (
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
          {formatInterval(result.interval, "KI")}
          <Uncertain transcripts={pair.transcripts} />
        </span>
      ) : null}
      <span className="block text-xs text-muted-foreground tabular-nums">
        {used
          ? `båda ${result.both} · bara ${coderName(first)} ${result.onlyFirst} · bara ${coderName(second)} ${result.onlySecond}`
          : "används inte"}
      </span>
    </td>
  );
}

function TranscriptTable({
  transcripts,
  studyCodes,
}: {
  transcripts: AgreementTranscript[];
  studyCodes: Record<string, string>;
}) {
  const rows = transcripts
    .map((row) => ({
      ...row,
      studyCode: studyCodes[row.sessionId] ?? row.participantCode,
    }))
    .sort(
      (a, b) =>
        a.studyCode.localeCompare(b.studyCode, "sv", { numeric: true }) ||
        a.lesson - b.lesson,
    );

  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-3xl border-collapse text-left text-sm">
        <caption className="sr-only">Kodade transkript</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="px-4 py-3 font-semibold">
              Deltagare
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Lektion
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Kodat av
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Prompter
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Prompter med olika koder
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sessionId} className="border-b last:border-0">
              <th
                scope="row"
                className="px-4 py-2 font-semibold whitespace-nowrap"
              >
                <Link
                  href={`/admin/participant/${row.studyCode}/lesson/${row.lesson}`}
                  title={
                    row.studyCode !== row.participantCode
                      ? `Inlämnad med kod ${row.participantCode}`
                      : undefined
                  }
                  className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Deltagare {row.studyCode}
                </Link>
              </th>
              <td className="px-4 py-2 tabular-nums">{row.lesson}</td>
              <td className="px-4 py-2">
                <span className="flex flex-wrap gap-1">
                  {row.coders.map((coder) => (
                    <span
                      key={coder}
                      className="rounded-md bg-muted/60 px-1.5 py-0.5 text-xs font-medium"
                    >
                      {coderName(coder)}
                    </span>
                  ))}
                </span>
              </td>
              <td className="px-4 py-2 tabular-nums">{row.prompts}</td>
              <td className="px-4 py-2 tabular-nums">
                {row.differing.length > 0
                  ? row.differing
                      .map(
                        (entry) =>
                          `${pairName(entry.pair)}: ${entry.prompts} av ${row.prompts}`,
                      )
                      .join(" · ")
                  : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Inga kodade transkript att visa.
        </p>
      ) : null}
    </div>
  );
}

function coderName(coder: Coder): string {
  return coder === "AI" ? "AI" : researcherName(coder);
}

function pairName(pair: CoderPair): string {
  const [first, second] = PAIR_CODERS[pair];
  return `${coderName(first)} – ${coderName(second)}`;
}

function formatAlpha(value: number | null): string {
  return value === null ? "–" : ALPHA.format(value);
}

// "till" rather than a dash when a bound is negative, so the minus sign can't be
// mistaken for the dash.
function formatInterval(interval: Interval | null, label: string): string {
  if (!interval) return `${label} kan inte beräknas`;
  const [low, high] = interval.map((bound) => ALPHA.format(bound));
  return `${label} ${low}${interval[0] < 0 ? " till " : "–"}${high}`;
}

function formatDifference(difference: Difference | null): string {
  const lead = `Jämfört med ${pairName("R1-R2")}:`;
  if (!difference) return `${lead} kan inte beräknas`;
  return `${lead} ${DIFFERENCE.format(difference.estimate)} (${formatInterval(difference.interval, "95 % KI")})`;
}

function Uncertain({
  transcripts,
  long = false,
}: {
  transcripts: number;
  long?: boolean;
}) {
  if (transcripts >= UNCERTAIN_BELOW) return null;
  return (
    <span
      className={UNCERTAIN_STYLE}
      title={`Färre än ${UNCERTAIN_BELOW} transkript`}
    >
      {long ? `Osäkert: färre än ${UNCERTAIN_BELOW} transkript` : "Osäkert"}
    </span>
  );
}
