import { alpha as packageAlpha } from "krippendorff";
import { describe, expect, test } from "vitest";

import {
  calculateCoderAgreement,
  compareFrameworkChanges,
  masiDistance,
  type AgreementSessionInput,
  type CoderAgreement,
  type CoderPair,
  type PromptCodes,
} from "@/lib/admin/coder-agreement";
import { applyFrameworkChanges } from "@/lib/admin/framework-changes";
import type { Lesson } from "@/lib/session/credentials";

const framework = {
  promptCodes: [
    { code: "NA1", name: "Ej relevant", level: "NA" },
    { code: "P1", name: "Passiv 1", level: "P" },
    { code: "P2", name: "Passiv 2", level: "P" },
    { code: "A2", name: "Aktiv 2", level: "A" },
    { code: "C3", name: "Konstruktiv 3", level: "C" },
    { code: "C10", name: "Konstruktiv 10", level: "C" },
  ],
};

function session(
  id: string,
  coding: Partial<Record<"R1" | "R2" | "AI", Record<number, string[]>>>,
  prompts: number[] = [1, 3, 5, 7],
): AgreementSessionInput {
  const [participantCode, lesson] = id.split("_");
  const entries = (byPrompt: Record<number, string[]> = {}): PromptCodes[] =>
    Object.entries(byPrompt).map(([message, codes]) => ({
      message: Number(message),
      codes,
    }));
  return {
    sessionId: id,
    participantCode,
    lesson: Number(lesson) as Lesson,
    prompts,
    coding: {
      R1: entries(coding.R1),
      R2: entries(coding.R2),
      AI: entries(coding.AI),
    },
  };
}

// Transcripts all three coded, with Frida and the AI agreeing with Armin part of the
// time, or the AI coding exactly as Armin does.
function randomSessions(
  count: number,
  aiCodesLikeArmin = false,
): AgreementSessionInput[] {
  let seed = 3;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  const codes = ["P1", "P2", "A2", "C3", "C10"];
  const randomSet = () => codes.filter(() => random() < 0.3);
  // Prompt 7 always has a code, so every coder has coded every transcript.
  const like = (armin: Record<number, string[]>, share: number) =>
    Object.fromEntries(
      [1, 3, 5, 7].map((message) => {
        const set = random() < share ? armin[message] : randomSet();
        return [message, message === 7 && set.length === 0 ? ["C3"] : set];
      }),
    );
  return Array.from({ length: count }, (_, s) => {
    const armin = like({ 1: [], 3: [], 5: [], 7: [] }, 0);
    return session(`${720 + s}_2`, {
      R1: armin,
      R2: like(armin, 0.7),
      AI: aiCodesLikeArmin ? armin : like(armin, 0.5),
    });
  });
}

function pairOf(
  agreement: CoderAgreement,
  pair: CoderPair,
  lesson: Lesson | null = null,
  base: "pair" | "allThree" = "pair",
) {
  const variant = agreement.variants.find(
    (candidate) => candidate.lesson === lesson && candidate.base === base,
  );
  return variant!.pairs.find((candidate) => candidate.pair === pair)!;
}

describe("masiDistance", () => {
  test("gives partial credit to sets that share codes", () => {
    const set = (...codes: string[]) => new Set(codes);
    expect(masiDistance(set("P1", "A2"), set("A2", "P1"))).toBe(0);
    expect(masiDistance(set(), set())).toBe(0);
    // A set inside the other: J = 1/2, weighted 2/3.
    expect(masiDistance(set("P1"), set("P1", "A2"))).toBeCloseTo(2 / 3, 12);
    // Overlapping sets: J = 1/3, weighted 1/3.
    expect(masiDistance(set("P1", "A2"), set("P1", "C3"))).toBeCloseTo(
      8 / 9,
      12,
    );
    expect(masiDistance(set("P1"), set("C3"))).toBe(1);
    expect(masiDistance(set(), set("C3"))).toBe(1);
  });
});

describe("calculateCoderAgreement", () => {
  test("compares the code sets of a transcript both researchers coded", () => {
    const agreement = calculateCoderAgreement(
      [
        session("701_2", {
          R1: { 1: ["P1"], 3: ["A2", "P1"], 7: ["C3"] },
          R2: { 1: ["P1"], 3: ["P1"] },
        }),
      ],
      framework,
    );
    const pair = pairOf(agreement, "R1-R2");

    expect(pair).toMatchObject({
      transcripts: 1,
      prompts: 4,
      promptsWithoutCodes: 1,
    });
    // Worked out by hand: 1 - 7 · (5/3) / 21.
    expect(pair.codes.alpha).toBeCloseTo(4 / 9, 12);
    expect(pair.codes).toMatchObject({
      identical: 2,
      firstTotal: 4,
      secondTotal: 2,
    });
    expect(pair.perCode).toEqual([
      { category: "P1", alpha: 1, both: 2, onlyFirst: 0, onlySecond: 0 },
      { category: "P2", alpha: null, both: 0, onlyFirst: 0, onlySecond: 0 },
      { category: "A2", alpha: 0, both: 0, onlyFirst: 1, onlySecond: 0 },
      { category: "C3", alpha: 0, both: 0, onlyFirst: 1, onlySecond: 0 },
      { category: "C10", alpha: null, both: 0, onlyFirst: 0, onlySecond: 0 },
    ]);
    // P1 + A2 and P1 differ on the levels the same way the codes do.
    expect(pair.levels.alpha).toBeCloseTo(4 / 9, 12);
    expect(pair.perLevel.map(({ category, both }) => [category, both])).toEqual(
      [
        ["P", 2],
        ["A", 0],
        ["C", 0],
      ],
    );
    expect(pairOf(agreement, "AI-R1")).toMatchObject({
      transcripts: 0,
      prompts: 0,
      codes: { alpha: null },
    });
    // One transcript cannot be redrawn into anything else.
    expect(pair.codes.interval).toBeNull();
  });

  test("counts a coder once they have given any code, NA included", () => {
    const agreement = calculateCoderAgreement(
      [
        session("702_2", {
          R1: { 1: ["NA1"] },
          // A note without codes is stored as an entry with no codes.
          R2: { 3: [] },
          AI: { 1: ["P1", "NA1"], 3: [], 5: ["C10"], 7: ["NA1"] },
        }),
      ],
      framework,
    );

    expect(agreement.transcripts).toEqual([
      {
        sessionId: "702_2",
        participantCode: "702",
        lesson: 2,
        prompts: 4,
        coders: ["R1", "AI"],
        differing: [{ pair: "AI-R1", prompts: 2 }],
      },
    ]);
    expect(pairOf(agreement, "R1-R2").transcripts).toBe(0);
    // Armin's NA-only prompt and the prompts he left out have no code; so do the
    // AI's empty and NA-only prompts.
    expect(pairOf(agreement, "AI-R1")).toMatchObject({
      transcripts: 1,
      prompts: 4,
      promptsWithoutCodes: 2,
      codes: { identical: 2, firstTotal: 2, secondTotal: 0 },
    });
  });

  test("ignores the order of codes and codes outside P, A and C", () => {
    const agreement = calculateCoderAgreement(
      [
        session("703_3", {
          R1: { 1: ["C10", "P1"], 3: ["A2"] },
          R2: { 1: ["P1", "C10", "X9"], 3: ["A2", "NA1"] },
        }),
      ],
      framework,
    );

    expect(pairOf(agreement, "R1-R2").codes).toMatchObject({
      identical: 4,
      firstTotal: 3,
      secondTotal: 3,
    });
    expect(agreement.transcripts[0].differing).toEqual([
      { pair: "R1-R2", prompts: 0 },
    ]);
  });

  test("counts a prompt on every ICAP level it has a code on", () => {
    const agreement = calculateCoderAgreement(
      [session("704_2", { R1: { 1: ["P1", "C10"] }, R2: { 1: ["C3"] } })],
      framework,
    );
    const pair = pairOf(agreement, "R1-R2");

    expect(pair.perLevel).toEqual([
      {
        category: "P",
        alpha: 0,
        interval: null,
        both: 0,
        onlyFirst: 1,
        onlySecond: 0,
      },
      {
        category: "A",
        alpha: null,
        interval: null,
        both: 0,
        onlyFirst: 0,
        onlySecond: 0,
      },
      {
        category: "C",
        alpha: 1,
        interval: null,
        both: 1,
        onlyFirst: 0,
        onlySecond: 0,
      },
    ]);
    expect(pair.levels).toMatchObject({ firstTotal: 2, secondTotal: 1 });
  });

  test("compares each pair on its own transcripts or on those all three coded", () => {
    const agreement = calculateCoderAgreement(
      [
        session("705_2", {
          R1: { 1: ["P1"] },
          R2: { 1: ["P1"] },
          AI: { 1: ["P1"] },
        }),
        session("705_3", { R1: { 1: ["A2"] }, AI: { 1: ["C3"] } }),
        session("706_3", { AI: { 1: ["P2"] } }),
      ],
      framework,
    );

    const transcripts = (lesson: Lesson | null, base: "pair" | "allThree") =>
      (["R1-R2", "AI-R1", "AI-R2"] as const).map(
        (pair) => pairOf(agreement, pair, lesson, base).transcripts,
      );
    expect(transcripts(null, "pair")).toEqual([1, 2, 1]);
    expect(transcripts(null, "allThree")).toEqual([1, 1, 1]);
    expect(transcripts(3, "pair")).toEqual([0, 1, 0]);
    expect(transcripts(3, "allThree")).toEqual([0, 0, 0]);
    expect(transcripts(1, "pair")).toEqual([0, 0, 0]);
    expect(agreement.variants).toHaveLength(10);
    expect(
      agreement.transcripts.map(({ sessionId, coders }) => [sessionId, coders]),
    ).toEqual([
      ["705_2", ["R1", "R2", "AI"]],
      ["705_3", ["R1", "AI"]],
      ["706_3", ["AI"]],
    ]);
  });

  test("leaves out transcripts nobody coded and prompts outside the transcript", () => {
    const agreement = calculateCoderAgreement(
      [
        session("707_1", {}),
        // Message 2 is not one of the transcript's prompts.
        session("708_1", { R1: { 2: ["P1"] }, R2: { 1: ["P1"] } }),
      ],
      framework,
    );

    expect(
      agreement.transcripts.map(({ sessionId, coders }) => [sessionId, coders]),
    ).toEqual([["708_1", ["R2"]]]);
  });

  test("gives the same set alpha as the krippendorff package with MASI", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const codes = ["P1", "P2", "A2", "C3", "C10"];
    const randomSet = () => codes.filter(() => random() < 0.3);
    const prompts = Array.from({ length: 40 }, (_, i) => i + 1);
    const first = prompts.map(randomSet);
    const second = prompts.map((message, i) =>
      random() < 0.5 ? first[i] : randomSet(),
    );
    first[0] = ["P1"];
    second[0] = ["P1", "A2"];
    const toCoding = (sets: string[][]) =>
      Object.fromEntries(prompts.map((message, i) => [message, sets[i]]));

    const agreement = calculateCoderAgreement(
      [
        session(
          "709_4",
          { R1: toCoding(first), R2: toCoding(second) },
          prompts,
        ),
      ],
      framework,
    );
    const key = (set: string[]) => [...set].sort().join(",");
    const parse = (value: string) => new Set(value ? value.split(",") : []);
    const expected = packageAlpha(
      [first.map(key), second.map(key)],
      (a: string, b: string) => masiDistance(parse(a), parse(b)),
    );

    expect(pairOf(agreement, "R1-R2").codes.alpha).toBeCloseTo(expected, 10);
  });

  test("gives intervals from redrawn transcripts, the same ones on every run", () => {
    const sessions = randomSessions(12);
    const agreement = calculateCoderAgreement(sessions, framework);
    const pair = pairOf(agreement, "R1-R2");
    const [low, high] = pair.codes.interval!;

    expect(low).toBeLessThan(high);
    expect(low).toBeLessThanOrEqual(pair.codes.alpha!);
    expect(high).toBeGreaterThanOrEqual(pair.codes.alpha!);
    expect(pair.levels.interval).not.toBeNull();
    expect(pair.perLevel.map((level) => level.interval === undefined)).toEqual([
      false,
      false,
      false,
    ]);
    expect(pair.perCode.some((code) => code.interval !== undefined)).toBe(
      false,
    );
    expect(agreement.bootstrap).toEqual({ resamples: 2000, seed: 76 });
    expect(calculateCoderAgreement(sessions, framework)).toEqual(agreement);
  });

  test("compares the AI with Armin–Frida only on the transcripts all three coded", () => {
    const agreement = calculateCoderAgreement(randomSessions(12), framework);
    const researchers = pairOf(agreement, "R1-R2", null, "allThree");
    const ai = pairOf(agreement, "AI-R1", null, "allThree");

    expect(ai.versusResearchers?.codes?.estimate).toBeCloseTo(
      ai.codes.alpha! - researchers.codes.alpha!,
      12,
    );
    expect(ai.versusResearchers?.codes?.interval).not.toBeNull();
    expect(ai.versusResearchers?.levels?.interval).not.toBeNull();
    expect(researchers.versusResearchers).toBeUndefined();
    expect(pairOf(agreement, "AI-R1").versusResearchers).toBeUndefined();
  });

  test("draws the same transcripts for every pair it compares", () => {
    // An AI that codes exactly as Armin does agrees with Frida exactly as Armin does
    // in every draw, so it differs from Armin–Frida by 0 throughout.
    const agreement = calculateCoderAgreement(
      randomSessions(12, true),
      framework,
    );
    const versus = pairOf(
      agreement,
      "AI-R2",
      null,
      "allThree",
    ).versusResearchers;

    expect(versus?.codes).toEqual({ estimate: 0, interval: [0, 0] });
    expect(versus?.levels).toEqual({ estimate: 0, interval: [0, 0] });
  });
});

describe("compareFrameworkChanges", () => {
  test("finds no change when nothing changes", () => {
    const sessions = randomSessions(12);
    const [all] = compareFrameworkChanges(sessions, framework, {
      sessions,
      framework,
    });
    const pair = all.pairs[0];

    expect(pair.codes.after).toBe(pair.codes.before);
    expect(pair.codes.difference).toEqual({ estimate: 0, interval: [0, 0] });
    expect(pair.affected).toBe(0);
  });

  test("shows the gain from merging codes the coders mix up, with an interval", () => {
    // On every other transcript Armin gives P1 where Frida gives A2.
    const sessions = Array.from({ length: 12 }, (_, s) =>
      session(`${740 + s}_2`, {
        R1: { 1: ["P1"], 3: ["C3"], 5: s % 2 ? ["P2"] : ["C10"] },
        R2: {
          1: s % 2 ? ["A2"] : ["P1"],
          3: ["C3"],
          5: s % 2 ? ["P2"] : ["C10"],
        },
      }),
    );
    const changed = applyFrameworkChanges(sessions, framework, [
      { kind: "merge", codes: ["P1", "A2"], level: "P" },
    ]);
    const [all] = compareFrameworkChanges(sessions, framework, changed);
    const pair = all.pairs[0];

    expect(pair.codes.after!).toBeGreaterThan(pair.codes.before!);
    expect(pair.codes.difference!.estimate).toBeCloseTo(
      pair.codes.after! - pair.codes.before!,
      12,
    );
    expect(pair.codes.difference!.interval![0]).toBeGreaterThan(0);
    // On level P, the merged prompts now agree on their level as well.
    expect(pair.levels.after!).toBeGreaterThan(pair.levels.before!);
    expect(pair).toMatchObject({ transcripts: 12, prompts: 48, affected: 12 });
  });
});
