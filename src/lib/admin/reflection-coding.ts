import { z } from "zod";

import type { ResearcherId } from "@/lib/admin/auth";

export const REFLECTION_CODING_FILE = "reflection_coding.JSON";

const criterion = z.object({
  id: z.string().regex(/^[A-Z0-9-]+$/),
  label: z.string().min(1),
});
const reflectionCodingFile = z.looseObject({
  version: z.string().min(1),
  states: z
    .array(
      z.object({
        state: z.number().int().positive(),
        criteria: z.array(criterion).min(1),
      }),
    )
    .min(1),
});

export type ReflectionCodingFramework = {
  version: string;
  states: { state: number; criteria: { id: string; label: string }[] }[];
};

export function parseReflectionCodingFramework(
  value: unknown,
): ReflectionCodingFramework {
  const parsed = reflectionCodingFile.parse(value);
  const ids = parsed.states.flatMap((state) =>
    state.criteria.map((entry) => entry.id),
  );
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${REFLECTION_CODING_FILE}: criterion ids repeat`);
  }
  return {
    version: parsed.version,
    states: parsed.states.map(({ state, criteria }) => ({
      state,
      criteria: criteria.map(({ id, label }) => ({ id, label })),
    })),
  };
}

export function criterionIds(framework: ReflectionCodingFramework): string[] {
  return framework.states.flatMap((state) =>
    state.criteria.map((entry) => entry.id),
  );
}

export function maxReflectionScore(
  framework: ReflectionCodingFramework,
): number {
  return criterionIds(framework).length;
}

// Ticks the file no longer has are ignored rather than counted (DL-083).
export function reflectionScore(
  criteria: readonly string[],
  framework: ReflectionCodingFramework,
): number {
  const known = new Set(criterionIds(framework));
  return new Set(criteria.filter((id) => known.has(id))).size;
}

// Each researcher's total for one moment, or null while they have not marked it coded.
export type MomentScores = Record<ResearcherId, number | null>;

export function momentScore(scores: MomentScores): number | null {
  const coded = [scores.R1, scores.R2].filter(
    (score): score is number => score !== null,
  );
  if (coded.length === 0) return null;
  return coded.reduce((sum, score) => sum + score, 0) / coded.length;
}

export function sessionReflectionAverage(moments: MomentScores[]): {
  average: number | null;
  coded: number;
  total: number;
} {
  const scores = moments
    .map(momentScore)
    .filter((score): score is number => score !== null);
  return {
    average:
      scores.length === 0
        ? null
        : scores.reduce((sum, score) => sum + score, 0) / scores.length,
    coded: scores.length,
    total: moments.length,
  };
}

const SCORE = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

export function formatReflectionScore(score: number): string {
  return SCORE.format(score);
}
