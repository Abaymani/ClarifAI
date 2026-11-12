"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  DevelopmentChart,
  LEVEL_COLOURS,
  LEVEL_NAMES,
  LevelMarker,
  type DevelopmentForm,
} from "@/app/admin/(portal)/development/development-chart";
import { coderName } from "@/app/admin/(portal)/agreement/agreement-format";
import type { Coder } from "@/lib/admin/coder-agreement";
import type { IcapLevel } from "@/lib/admin/icap-counts";
import {
  DEVELOPMENT_CODERS,
  DEVELOPMENT_LEVELS,
  levelChange,
  type DevelopmentScale,
  type StudentDevelopment,
} from "@/lib/admin/student-development";

type Sort = "code" | IcapLevel;

const SORT_OPTIONS: [Sort, string][] = [
  ["code", "Deltagarkod"],
  ["P", "Störst minskning i P"],
  ["A", "Störst ökning i A"],
  ["C", "Störst ökning i C"],
];
const POINTS = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export function StudentDevelopmentView({
  students,
}: {
  students: StudentDevelopment[];
}) {
  const [coder, setCoder] = useState<Coder>("AI");
  const [scale, setScale] = useState<DevelopmentScale>("share");
  const [form, setForm] = useState<DevelopmentForm>("bars");
  const [sort, setSort] = useState<Sort>("code");
  const [allFourOnly, setAllFourOnly] = useState(false);

  const sorted = useMemo(
    () =>
      sortStudents(
        allFourOnly
          ? students.filter((student) =>
              student.lessons[coder].every(
                (lesson) => lesson.state === "coded",
              ),
            )
          : students,
        coder,
        scale,
        sort,
      ),
    [students, coder, scale, sort, allFourOnly],
  );

  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Inga transkript ännu. Kort visas här när deltagare har lämnat in en
        chatt.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented
          label="Källa"
          value={coder}
          onChange={setCoder}
          options={DEVELOPMENT_CODERS.map((option) => [
            option,
            coderName(option),
          ])}
        />
        <Segmented
          label="Visa"
          value={scale}
          onChange={setScale}
          options={[
            ["share", "Andel"],
            ["count", "Antal"],
          ]}
        />
        <Segmented
          label="Diagram"
          value={form}
          onChange={setForm}
          options={[
            ["bars", "Staplar"],
            ["lines", "Linjer"],
          ]}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="development-sort" className="text-sm font-medium">
            Sortera
          </label>
          <select
            id="development-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="h-10 min-w-56 rounded-lg border bg-background px-3 text-sm"
          >
            {SORT_OPTIONS.map(([option, label]) => (
              <option key={option} value={option}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allFourOnly}
            onChange={(event) => setAllFourOnly(event.target.checked)}
            className="size-4"
          />
          Visa bara deltagare med alla fyra lektioner kodade
        </label>
      </div>

      <Legend coder={coder} scale={scale} form={form} />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Visar {sorted.length} av {students.length} deltagare
        {allFourOnly
          ? `, alla fyra lektioner kodade av ${coderName(coder)}`
          : ""}
        .
      </p>

      <ul
        aria-label="Deltagare"
        className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3"
      >
        {sorted.map((student) => (
          <li
            key={student.participantCode}
            className="rounded-xl border bg-card px-3 pt-2 pb-1"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">
                Deltagare {student.participantCode}
              </h2>
              <span className="text-xs text-muted-foreground">
                {cardNote(student, coder, scale, sort)}
              </span>
            </div>
            <DevelopmentChart
              lessons={student.lessons[coder]}
              form={form}
              scale={scale}
              coderLabel={coderName(coder)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span id={`development-${label}`} className="text-sm font-medium">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`development-${label}`}
        className="flex w-fit rounded-lg bg-muted p-1"
      >
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${option === value ? "bg-background shadow-xs" : "text-muted-foreground"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Legend({
  coder,
  scale,
  form,
}: {
  coder: Coder;
  scale: DevelopmentScale;
  form: DevelopmentForm;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {DEVELOPMENT_LEVELS.map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            {form === "lines" ? (
              <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
                <LevelMarker level={level} x={6} y={6.5} />
              </svg>
            ) : (
              <span
                aria-hidden="true"
                className="size-2.5 rounded-xs"
                style={{ background: LEVEL_COLOURS[level] }}
              />
            )}
            {level} {LEVEL_NAMES[level].toLowerCase()}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-xs bg-muted-foreground/15"
          />
          ingen kodning från {coderName(coder)}
        </span>
      </div>
      <p className="text-xs">
        {scale === "share"
          ? "Andel av promptkoderna på P, A och C."
          : "Antal promptkoder på P, A och C."}{" "}
        Varje kod räknas och NA räknas inte. Varje kort har sin egen skala, så
        jämför kort med siffrorna på axeln. Förändringen räknas från den första
        till den sista kodade lektionen.
      </p>
    </div>
  );
}

function sortStudents(
  students: readonly StudentDevelopment[],
  coder: Coder,
  scale: DevelopmentScale,
  sort: Sort,
): StudentDevelopment[] {
  if (sort === "code") return [...students];
  // P is sorted by its largest decrease, A and C by their largest increase.
  const direction = sort === "P" ? 1 : -1;
  return [...students].sort((a, b) => {
    const first = levelChange(a.lessons[coder], sort, scale);
    const second = levelChange(b.lessons[coder], sort, scale);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return direction * (first - second);
  });
}

function cardNote(
  student: StudentDevelopment,
  coder: Coder,
  scale: DevelopmentScale,
  sort: Sort,
): string {
  if (sort === "code") {
    const coded = student.lessons[coder].filter(
      (lesson) => lesson.state === "coded",
    ).length;
    return `${coded} av 4 kodade`;
  }
  const change = levelChange(student.lessons[coder], sort, scale);
  if (change === null) return "för få kodade lektioner";
  return scale === "share"
    ? `${POINTS.format(change * 100)} p.e. ${sort}`
    : `${POINTS.format(change)} ${sort}`;
}
