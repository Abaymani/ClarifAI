// Agreement between Armin, Frida and the AI on prompt codes, for the agreement page
// (DL-076). A coder has coded a transcript once they have given any prompt in it a
// code, NA included; their other prompts in it then have no applicable code. NA
// codes are left out of the comparison, and the order of codes does not matter.
import type { ResearcherId } from "@/lib/admin/auth";
import { promptCodeLevels, type IcapLevel } from "@/lib/admin/icap-counts";
import { krippendorffAlpha } from "@/lib/admin/krippendorff-alpha";
import type { Framework } from "@/lib/analysis/framework";
import { LESSONS, type Lesson } from "@/lib/session/credentials";

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

export type CategoryAgreement = {
  category: string;
  alpha: number | null;
  both: number;
  onlyFirst: number;
  onlySecond: number;
};

export type SetAgreement = {
  alpha: number | null;
  identical: number;
  // Codes, or levels, given over all compared prompts.
  firstTotal: number;
  secondTotal: number;
};

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
  transcripts: AgreementTranscript[];
  variants: AgreementVariant[];
};

export type StoredCoderAgreement = CoderAgreement & {
  calculatedAt: string;
  calculatedBy: ResearcherId;
};

export const CODERS: readonly Coder[] = ["R1", "R2", "AI"];
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

// Each coder who coded the transcript: the P, A and C codes of every prompt, in
// prompt order and sorted, so equal sets are equal arrays.
type CodedTranscript = {
  session: AgreementSessionInput;
  codeSets: Partial<Record<Coder, string[][]>>;
};

export function calculateCoderAgreement(
  sessions: readonly AgreementSessionInput[],
  framework: Pick<Framework, "promptCodes">,
): CoderAgreement {
  const levels = promptCodeLevels(framework);
  const comparedCodes = framework.promptCodes
    .map((entry) => entry.code)
    .filter((code) => isLevel(levels.get(code)));
  const compared = new Set(comparedCodes);
  const coded = sessions.map((session) => codedTranscript(session, compared));
  const levelSets = (sets: string[][]) =>
    sets.map((set) =>
      LEVELS.filter((level) => set.some((code) => levels.get(code) === level)),
    );

  const variants = [null, ...LESSONS].flatMap((lesson) =>
    BASES.map((base): AgreementVariant => {
      const pool = coded.filter(
        (transcript) =>
          (lesson === null || transcript.session.lesson === lesson) &&
          (base === "pair" ||
            CODERS.every((coder) => transcript.codeSets[coder])),
      );
      return {
        lesson,
        base,
        pairs: PAIRS.map(({ pair, first, second }) => {
          const shared = pool.filter(
            (transcript) =>
              transcript.codeSets[first] && transcript.codeSets[second],
          );
          const a = shared.flatMap((transcript) => transcript.codeSets[first]!);
          const b = shared.flatMap(
            (transcript) => transcript.codeSets[second]!,
          );
          const [levelsA, levelsB] = [levelSets(a), levelSets(b)];
          return {
            pair,
            transcripts: shared.length,
            prompts: a.length,
            promptsWithoutCodes: a.filter(
              (set, i) => set.length === 0 && b[i].length === 0,
            ).length,
            codes: setAgreement(a, b),
            levels: setAgreement(levelsA, levelsB),
            perCode: comparedCodes.map((code) => categoryAgreement(code, a, b)),
            perLevel: LEVELS.map((level) =>
              categoryAgreement(level, levelsA, levelsB),
            ),
          };
        }),
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

  return { transcripts, variants };
}

function codedTranscript(
  session: AgreementSessionInput,
  comparedCodes: ReadonlySet<string>,
): CodedTranscript {
  const prompts = new Set(session.prompts);
  const codeSets: CodedTranscript["codeSets"] = {};
  for (const coder of CODERS) {
    const byPrompt = new Map<number, readonly string[]>();
    for (const entry of session.coding[coder]) {
      if (prompts.has(entry.message) && entry.codes.length > 0) {
        byPrompt.set(entry.message, entry.codes);
      }
    }
    if (byPrompt.size === 0) continue;
    codeSets[coder] = session.prompts.map((message) =>
      [...new Set(byPrompt.get(message) ?? [])]
        .filter((code) => comparedCodes.has(code))
        .sort(),
    );
  }
  return { session, codeSets };
}

function setAgreement(a: string[][], b: string[][]): SetAgreement {
  const keysA = a.map(setKey);
  const keysB = b.map(setKey);
  const sets = new Map([...a, ...b].map((set) => [setKey(set), new Set(set)]));
  return {
    alpha: krippendorffAlpha([keysA, keysB], (x, y) =>
      masiDistance(sets.get(x)!, sets.get(y)!),
    ),
    identical: keysA.filter((key, i) => key === keysB[i]).length,
    firstTotal: a.reduce((total, set) => total + set.length, 0),
    secondTotal: b.reduce((total, set) => total + set.length, 0),
  };
}

function categoryAgreement(
  category: string,
  a: string[][],
  b: string[][],
): CategoryAgreement {
  const inA = a.map((set) => (set.includes(category) ? 1 : 0));
  const inB = b.map((set) => (set.includes(category) ? 1 : 0));
  const both = inA.filter((value, i) => value === 1 && inB[i] === 1).length;
  const onlyFirst = inA.filter(
    (value, i) => value === 1 && inB[i] === 0,
  ).length;
  const onlySecond = inB.filter(
    (value, i) => value === 1 && inA[i] === 0,
  ).length;
  return {
    category,
    alpha: krippendorffAlpha([inA, inB]),
    both,
    onlyFirst,
    onlySecond,
  };
}

function setKey(set: readonly string[]): string {
  return set.join(",");
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
