// Agreement between Armin, Frida and the AI on prompt codes, for the agreement page
// (DL-076). A coder has coded a transcript once they have given any prompt in it a
// code, NA included; their other prompts in it then have no applicable code. NA
// codes are left out of the comparison, and the order of codes does not matter.
import type { ResearcherId } from "@/lib/admin/auth";
import { bootstrapIntervals, type Interval } from "@/lib/admin/bootstrap";
import { promptCodeLevels, type IcapLevel } from "@/lib/admin/icap-counts";
import {
  alphaGroups,
  groupedAlpha,
  krippendorffAlpha,
  type AlphaGroups,
} from "@/lib/admin/krippendorff-alpha";
import type { Framework } from "@/lib/analysis/framework";
import { LESSONS, type Lesson } from "@/lib/session/credentials";

export type { Interval };

export type Coder = ResearcherId | "AI";
export type CoderPair = "R1-R2" | "AI-R1" | "AI-R2";
// Every pair is compared on the transcripts both of its coders coded, or only on
// those all three coded, so that the pairs share one set of transcripts.
export type AgreementBase = "pair" | "allThree";

export type PromptCodes = { message: number; codes: readonly string[] };

export type AgreementSessionInput = {
  sessionId: string;
  participantCode: string;
  lesson: Lesson;
  // Message numbers of the transcript's student prompts.
  prompts: readonly number[];
  coding: Readonly<Record<Coder, readonly PromptCodes[]>>;
};

// Intervals are 95 % bootstrap intervals over transcripts, null when they cannot be
// calculated (DL-077). Results stored before then have none.
export type CategoryAgreement = {
  category: string;
  alpha: number | null;
  // Only for ICAP levels; codes are mostly too rare for a useful interval.
  interval?: Interval | null;
  both: number;
  onlyFirst: number;
  onlySecond: number;
};

export type SetAgreement = {
  alpha: number | null;
  interval?: Interval | null;
  identical: number;
  // Codes, or levels, given over all compared prompts.
  firstTotal: number;
  secondTotal: number;
};

export type Difference = { estimate: number; interval: Interval | null };

export type PairAgreement = {
  pair: CoderPair;
  transcripts: number;
  prompts: number;
  // Prompts where neither coder gave a code other than NA; they count as agreeing
  // that no code applies.
  promptsWithoutCodes: number;
  codes: SetAgreement;
  levels: SetAgreement;
  perCode: CategoryAgreement[];
  perLevel: CategoryAgreement[];
  // For the AI's pairs on the transcripts all three coded: their alpha minus
  // Armin–Frida's, null where either is undefined.
  versusResearchers?: { codes: Difference | null; levels: Difference | null };
};

export type AgreementVariant = {
  // Null for all lessons together.
  lesson: Lesson | null;
  base: AgreementBase;
  pairs: PairAgreement[];
};

export type AgreementTranscript = {
  sessionId: string;
  participantCode: string;
  lesson: Lesson;
  prompts: number;
  coders: Coder[];
  // Prompts given different codes, for each pair whose coders both coded it.
  differing: { pair: CoderPair; prompts: number }[];
};

export type CoderAgreement = {
  bootstrap?: { resamples: number; seed: number };
  transcripts: AgreementTranscript[];
  variants: AgreementVariant[];
};

export type StoredCoderAgreement = CoderAgreement & {
  calculatedAt: string;
  calculatedBy: ResearcherId;
};

// Alpha before and after trying framework changes, and the change between them.
export type Change = {
  before: number | null;
  after: number | null;
  difference: Difference | null;
};

export type PairChange = {
  pair: CoderPair;
  transcripts: number;
  prompts: number;
  // Prompts where either coder gave a code that the changes merge or delete.
  affected: number;
  codes: Change;
  levels: Change;
};

export type ChangeVariant = {
  lesson: Lesson | null;
  base: AgreementBase;
  pairs: PairChange[];
};

export const CODERS: readonly Coder[] = ["R1", "R2", "AI"];
// Armin–Frida first: the AI's pairs are compared with it.
export const PAIRS: readonly {
  pair: CoderPair;
  first: Coder;
  second: Coder;
}[] = [
  { pair: "R1-R2", first: "R1", second: "R2" },
  { pair: "AI-R1", first: "AI", second: "R1" },
  { pair: "AI-R2", first: "AI", second: "R2" },
];
const LEVELS = ["P", "A", "C"] as const satisfies readonly IcapLevel[];
const BASES: readonly AgreementBase[] = ["pair", "allThree"];
const BOOTSTRAP = { resamples: 2000, seed: 76 };
// Per pair: the alphas of code sets, level sets and each level, in that order.
const STATISTICS = 2 + LEVELS.length;

// Each coder who coded the transcript: the P, A and C codes of every prompt, in
// prompt order and sorted, so equal sets are equal arrays, and the levels of those
// codes in P, A, C order.
type CodedTranscript = {
  session: AgreementSessionInput;
  codeSets: Partial<Record<Coder, string[][]>>;
  levelSets: Partial<Record<Coder, string[][]>>;
};

type PairInputs = {
  codes: AlphaGroups;
  levels: AlphaGroups;
  perLevel: AlphaGroups[];
};

export function calculateCoderAgreement(
  sessions: readonly AgreementSessionInput[],
  framework: Pick<Framework, "promptCodes">,
): CoderAgreement {
  const { coded, comparedCodes } = codedTranscripts(sessions, framework);

  const variants = [null, ...LESSONS].flatMap((lesson, l) =>
    BASES.map((base, b): AgreementVariant => {
      const pool = coded.filter((transcript) =>
        inVariant(transcript, lesson, base),
      );
      return {
        lesson,
        base,
        pairs: comparePairs(
          pool,
          base,
          comparedCodes,
          BOOTSTRAP.seed + 10 * (2 * l + b),
        ),
      };
    }),
  );

  const transcripts = coded.flatMap(({ session, codeSets }) => {
    const coders = CODERS.filter((coder) => codeSets[coder]);
    if (coders.length === 0) return [];
    return [
      {
        sessionId: session.sessionId,
        participantCode: session.participantCode,
        lesson: session.lesson,
        prompts: session.prompts.length,
        coders,
        differing: PAIRS.flatMap(({ pair, first, second }) => {
          const a = codeSets[first];
          const b = codeSets[second];
          if (!a || !b) return [];
          return [
            {
              pair,
              prompts: a.filter((set, i) => setKey(set) !== setKey(b[i]))
                .length,
            },
          ];
        }),
      },
    ];
  });

  return { bootstrap: BOOTSTRAP, transcripts, variants };
}

// Alpha before and after framework changes, on the same transcripts and the same
// draws, so the change itself gets an interval (DL-078). The changed coding must
// leave every coder's set of coded transcripts as it was, which merges and
// deletions do.
export function compareFrameworkChanges(
  sessions: readonly AgreementSessionInput[],
  framework: Pick<Framework, "promptCodes">,
  changed: {
    sessions: readonly AgreementSessionInput[];
    framework: Pick<Framework, "promptCodes">;
  },
): ChangeVariant[] {
  const before = codedTranscripts(sessions, framework);
  const after = codedTranscripts(changed.sessions, changed.framework);
  const kept = new Set(after.comparedCodes);
  const touched = new Set(
    before.comparedCodes.filter((code) => !kept.has(code)),
  );

  return [null, ...LESSONS].flatMap((lesson, l) =>
    BASES.map((base, b): ChangeVariant => {
      const seed = BOOTSTRAP.seed + 10 * (2 * l + b);
      const pool = before.coded
        .map((transcript, t) => ({ transcript, t }))
        .filter(({ transcript }) => inVariant(transcript, lesson, base));

      return {
        lesson,
        base,
        pairs: PAIRS.map(({ pair, first, second }, p): PairChange => {
          const shared = pool
            .filter(
              ({ transcript }) =>
                transcript.codeSets[first] && transcript.codeSets[second],
            )
            .map(({ t }) => t);
          const inputs = [before.coded, after.coded].map((coded) =>
            pairInputs(
              shared.map((t) => coded[t]),
              first,
              second,
            ),
          );
          const alphas = (weights?: number[]) =>
            inputs.map((input) =>
              [input.codes, input.levels].map((groups) =>
                groupedAlpha(groups, weights),
              ),
            );
          const [[codesBefore, levelsBefore], [codesAfter, levelsAfter]] =
            alphas();
          const [codesInterval, levelsInterval] = bootstrapIntervals(
            shared.length,
            (weights) => {
              const [[codesB, levelsB], [codesA, levelsA]] = alphas(weights);
              return [minus(codesA, codesB), minus(levelsA, levelsB)];
            },
            { resamples: BOOTSTRAP.resamples, seed: seed + 1 + p },
          );
          const a = shared.flatMap((t) => before.coded[t].codeSets[first]!);
          const b = shared.flatMap((t) => before.coded[t].codeSets[second]!);

          return {
            pair,
            transcripts: shared.length,
            prompts: a.length,
            affected: a.filter(
              (set, i) =>
                set.some((code) => touched.has(code)) ||
                b[i].some((code) => touched.has(code)),
            ).length,
            codes: {
              before: codesBefore,
              after: codesAfter,
              difference: difference(codesAfter, codesBefore, codesInterval),
            },
            levels: {
              before: levelsBefore,
              after: levelsAfter,
              difference: difference(levelsAfter, levelsBefore, levelsInterval),
            },
          };
        }),
      };
    }),
  );
}

// On the transcripts all three coded, one bootstrap draws the same transcripts for
// every pair, so the difference between two pairs' alphas gets an interval too.
function comparePairs(
  pool: CodedTranscript[],
  base: AgreementBase,
  comparedCodes: readonly string[],
  seed: number,
): PairAgreement[] {
  const pairs = PAIRS.map(({ pair, first, second }) => {
    const shared = pool.filter(
      (transcript) => transcript.codeSets[first] && transcript.codeSets[second],
    );
    return { pair, first, second, shared };
  });
  const inputs = pairs.map(({ first, second, shared }) =>
    pairInputs(shared, first, second),
  );
  const estimates = inputs.map((input) => pairStatistics(input));
  const together =
    base === "allThree"
      ? bootstrapIntervals(
          pool.length,
          (weights) =>
            withDifferences(
              inputs.map((input) => pairStatistics(input, weights)),
            ),
          { resamples: BOOTSTRAP.resamples, seed },
        )
      : null;
  // Where withDifferences puts the code-set and level-set differences of the AI
  // pairs, which come right after Armin–Frida in PAIRS.
  const codeDifferences = STATISTICS * PAIRS.length - 1;
  const levelDifferences = codeDifferences + PAIRS.length - 1;

  return pairs.map(({ pair, first, second, shared }, p) => {
    const intervals =
      together?.slice(STATISTICS * p, STATISTICS * (p + 1)) ??
      bootstrapIntervals(
        shared.length,
        (weights) => pairStatistics(inputs[p], weights),
        { resamples: BOOTSTRAP.resamples, seed: seed + 1 + p },
      );
    const [codesAlpha, levelsAlpha, ...levelAlphas] = estimates[p];
    const [codesInterval, levelsInterval, ...levelIntervals] = intervals;
    const a = shared.flatMap((transcript) => transcript.codeSets[first]!);
    const b = shared.flatMap((transcript) => transcript.codeSets[second]!);
    const levelsA = shared.flatMap(
      (transcript) => transcript.levelSets[first]!,
    );
    const levelsB = shared.flatMap(
      (transcript) => transcript.levelSets[second]!,
    );

    return {
      pair,
      transcripts: shared.length,
      prompts: a.length,
      promptsWithoutCodes: a.filter(
        (set, i) => set.length === 0 && b[i].length === 0,
      ).length,
      codes: { alpha: codesAlpha, interval: codesInterval, ...setCounts(a, b) },
      levels: {
        alpha: levelsAlpha,
        interval: levelsInterval,
        ...setCounts(levelsA, levelsB),
      },
      perCode: comparedCodes.map((code) =>
        categoryAgreement(
          code,
          a,
          b,
          krippendorffAlpha([flags(a, code), flags(b, code)]),
        ),
      ),
      perLevel: LEVELS.map((level, k) => ({
        ...categoryAgreement(level, levelsA, levelsB, levelAlphas[k]),
        interval: levelIntervals[k],
      })),
      ...(together && first === "AI"
        ? {
            versusResearchers: {
              codes: difference(
                codesAlpha,
                estimates[0][0],
                together[codeDifferences + p],
              ),
              levels: difference(
                levelsAlpha,
                estimates[0][1],
                together[levelDifferences + p],
              ),
            },
          }
        : {}),
    };
  });
}

function pairInputs(
  shared: CodedTranscript[],
  first: Coder,
  second: Coder,
): PairInputs {
  const masi = masiBetweenKeys();
  const keys = (sets: string[][]) => sets.map(setKey);
  return {
    codes: alphaGroups(
      shared.map((transcript) => [
        keys(transcript.codeSets[first]!),
        keys(transcript.codeSets[second]!),
      ]),
      masi,
    ),
    levels: alphaGroups(
      shared.map((transcript) => [
        keys(transcript.levelSets[first]!),
        keys(transcript.levelSets[second]!),
      ]),
      masi,
    ),
    perLevel: LEVELS.map((level) =>
      alphaGroups(
        shared.map((transcript) => [
          flags(transcript.levelSets[first]!, level),
          flags(transcript.levelSets[second]!, level),
        ]),
      ),
    ),
  };
}

function pairStatistics(
  inputs: PairInputs,
  weights?: number[],
): (number | null)[] {
  return [inputs.codes, inputs.levels, ...inputs.perLevel].map((input) =>
    groupedAlpha(input, weights),
  );
}

// Every pair's statistics, then each AI pair's code-set and level-set alpha minus
// Armin–Frida's: codes for both AI pairs first, then levels.
function withDifferences(perPair: (number | null)[][]): (number | null)[] {
  const [researchers, ...ai] = perPair;
  return [
    ...perPair.flat(),
    ...ai.map((statistics) => minus(statistics[0], researchers[0])),
    ...ai.map((statistics) => minus(statistics[1], researchers[1])),
  ];
}

function minus(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a - b;
}

function difference(
  estimate: number | null,
  reference: number | null,
  interval: Interval | null,
): Difference | null {
  return estimate === null || reference === null
    ? null
    : { estimate: estimate - reference, interval };
}

function codedTranscripts(
  sessions: readonly AgreementSessionInput[],
  framework: Pick<Framework, "promptCodes">,
): { coded: CodedTranscript[]; comparedCodes: string[] } {
  const levels = promptCodeLevels(framework);
  const comparedCodes = framework.promptCodes
    .map((entry) => entry.code)
    .filter((code) => isLevel(levels.get(code)));
  const compared = new Set(comparedCodes);
  return {
    coded: sessions.map((session) =>
      codedTranscript(session, compared, levels),
    ),
    comparedCodes,
  };
}

function inVariant(
  transcript: CodedTranscript,
  lesson: Lesson | null,
  base: AgreementBase,
): boolean {
  return (
    (lesson === null || transcript.session.lesson === lesson) &&
    (base === "pair" || CODERS.every((coder) => transcript.codeSets[coder]))
  );
}

function codedTranscript(
  session: AgreementSessionInput,
  comparedCodes: ReadonlySet<string>,
  levels: ReadonlyMap<string, string>,
): CodedTranscript {
  const prompts = new Set(session.prompts);
  const codeSets: CodedTranscript["codeSets"] = {};
  const levelSets: CodedTranscript["levelSets"] = {};
  for (const coder of CODERS) {
    const byPrompt = new Map<number, readonly string[]>();
    for (const entry of session.coding[coder]) {
      if (prompts.has(entry.message) && entry.codes.length > 0) {
        byPrompt.set(entry.message, entry.codes);
      }
    }
    if (byPrompt.size === 0) continue;
    const sets = session.prompts.map((message) =>
      [...new Set(byPrompt.get(message) ?? [])]
        .filter((code) => comparedCodes.has(code))
        .sort(),
    );
    codeSets[coder] = sets;
    levelSets[coder] = sets.map((set) =>
      LEVELS.filter((level) => set.some((code) => levels.get(code) === level)),
    );
  }
  return { session, codeSets, levelSets };
}

function setCounts(
  a: string[][],
  b: string[][],
): Pick<SetAgreement, "identical" | "firstTotal" | "secondTotal"> {
  return {
    identical: a.filter((set, i) => setKey(set) === setKey(b[i])).length,
    firstTotal: a.reduce((total, set) => total + set.length, 0),
    secondTotal: b.reduce((total, set) => total + set.length, 0),
  };
}

function categoryAgreement(
  category: string,
  a: string[][],
  b: string[][],
  alpha: number | null,
): CategoryAgreement {
  const inA = flags(a, category);
  const inB = flags(b, category);
  return {
    category,
    alpha,
    both: inA.filter((value, i) => value === 1 && inB[i] === 1).length,
    onlyFirst: inA.filter((value, i) => value === 1 && inB[i] === 0).length,
    onlySecond: inB.filter((value, i) => value === 1 && inA[i] === 0).length,
  };
}

function flags(sets: string[][], category: string): number[] {
  return sets.map((set) => (set.includes(category) ? 1 : 0));
}

function setKey(set: readonly string[]): string {
  return set.join(",");
}

// Sets are compared by their keys; each key is split once.
function masiBetweenKeys(): (a: string, b: string) => number {
  const sets = new Map<string, Set<string>>();
  const setOf = (key: string) => {
    let set = sets.get(key);
    if (!set) {
      set = new Set(key ? key.split(",") : []);
      sets.set(key, set);
    }
    return set;
  };
  return (a, b) => masiDistance(setOf(a), setOf(b));
}

// MASI (Passonneau 2006) gives partial credit to sets that share codes: equal sets
// are 0 apart, a set inside the other 1 - J·2/3, other overlapping sets 1 - J·1/3
// and disjoint sets 1, where J is the Jaccard index.
export function masiDistance(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number {
  let shared = 0;
  for (const code of a) if (b.has(code)) shared += 1;
  if (shared === a.size && shared === b.size) return 0;
  const jaccard = shared / (a.size + b.size - shared);
  const monotonicity =
    shared === Math.min(a.size, b.size) ? 2 / 3 : shared > 0 ? 1 / 3 : 0;
  return 1 - jaccard * monotonicity;
}

function isLevel(level: string | undefined): level is IcapLevel {
  return (LEVELS as readonly (string | undefined)[]).includes(level);
}
