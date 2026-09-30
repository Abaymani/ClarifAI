import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { AnalysisError } from "./errors";

export const FRAMEWORK_FILES = {
  promptCoding: "prompt_coding.JSON",
  sequenceCoding: "sequence_coding.JSON",
  grouping: "behaviour_grouping.JSON",
  codingGuidelines: "analysis_guidelines.md",
  reflectionGuidelines: "reflection_guidelines.md",
} as const;

const TEST_STATUS = "TEST";

// Loose objects: the researchers may add fields, and everything they add is passed
// on to the model. Only what the code relies on is required.
const entry = z.looseObject({
  code: z.string().min(1),
  name: z.string().min(1),
});
const header = { status: z.string().min(1), version: z.string().min(1) };
const promptCodingFile = z.looseObject({
  ...header,
  icapCategories: z.array(entry),
  codes: z.array(entry).min(1),
});
const sequenceCodingFile = z.looseObject({
  ...header,
  patterns: z.array(entry).min(1),
});
// `intro` is what the researchers call Inledning (R groups) or Återkoppling (F
// groups). Bracketed parts of the texts are filled in per student.
const group = z.looseObject({
  code: z.string().min(1),
  // "general" is used when nothing in the chat suits reflection, and "none" for
  // codes that are never reflected on.
  kind: z.enum(["reflect", "reinforce", "general", "no_transcript", "none"]),
  name: z.string().min(1),
  behaviourCodes: z.array(z.string()),
  intro: z.string().min(1).nullable(),
  questions: z.array(z.string().min(1)),
  tip: z.string().min(1).nullable(),
});
const groupingFile = z.looseObject({
  ...header,
  groups: z.array(group).min(1),
});

export type FrameworkEntry = z.infer<typeof entry>;
export type BehaviourGroup = z.infer<typeof group>;
export type ReflectionTexts = {
  intro: string;
  questions: string[];
  tip: string | null;
};

export type Framework = {
  status: string;
  version: string;
  isTest: boolean;
  icapCategories: FrameworkEntry[];
  promptCodes: FrameworkEntry[];
  sequencePatterns: FrameworkEntry[];
  groups: BehaviourGroup[];
  groupByCode: ReadonlyMap<string, BehaviourGroup>;
  generalGroup: BehaviourGroup;
  noTranscriptGroup: BehaviourGroup | null;
  codingGuidelines: string;
  // Optional: guidance for choosing examples and adapting questions. Kept apart
  // from the coding guidelines so the coding step never sees it (DL-035).
  reflectionGuidelines: string | null;
};

export type FrameworkFiles = {
  promptCoding: unknown;
  sequenceCoding: unknown;
  grouping: unknown;
  codingGuidelines: string;
  reflectionGuidelines: string | null;
};

// The path is fixed to `framework/`, which lets the build ship exactly that folder
// with the server code. A path the build cannot follow would make it bundle the
// whole project instead.
function readFrameworkFile(name: string): string | null {
  try {
    return readFileSync(join(process.cwd(), "framework", name), "utf8");
  } catch {
    return null;
  }
}

// Read on every analysis, so edited framework files apply without a restart.
export function loadFramework(
  read: (name: string) => string | null = readFrameworkFile,
): Framework {
  const required = (name: string): string => {
    const text = read(name);
    if (text === null) {
      throw new AnalysisError("S2-FRAMEWORK", [`${name}: cannot be read`]);
    }
    return text;
  };
  const json = (name: string): unknown => {
    const text = required(name);
    try {
      return JSON.parse(text);
    } catch {
      throw new AnalysisError("S2-FRAMEWORK", [`${name}: not valid JSON`]);
    }
  };

  return parseFramework({
    promptCoding: json(FRAMEWORK_FILES.promptCoding),
    sequenceCoding: json(FRAMEWORK_FILES.sequenceCoding),
    grouping: json(FRAMEWORK_FILES.grouping),
    codingGuidelines: required(FRAMEWORK_FILES.codingGuidelines),
    reflectionGuidelines: read(FRAMEWORK_FILES.reflectionGuidelines),
  });
}

export function parseFramework(files: FrameworkFiles): Framework {
  const prompts = promptCodingFile.safeParse(files.promptCoding);
  const sequences = sequenceCodingFile.safeParse(files.sequenceCoding);
  const grouping = groupingFile.safeParse(files.grouping);
  const shapeProblems = [
    ...issues(FRAMEWORK_FILES.promptCoding, prompts),
    ...issues(FRAMEWORK_FILES.sequenceCoding, sequences),
    ...issues(FRAMEWORK_FILES.grouping, grouping),
  ];
  if (!prompts.success || !sequences.success || !grouping.success) {
    throw new AnalysisError("S2-FRAMEWORK", shapeProblems);
  }

  const problems: string[] = [];
  const { status, version } = prompts.data;
  for (const [name, file] of [
    [FRAMEWORK_FILES.sequenceCoding, sequences.data],
    [FRAMEWORK_FILES.grouping, grouping.data],
  ] as const) {
    if (file.status !== status || file.version !== version) {
      problems.push(`${name}: status or version differs from the prompt codes`);
    }
  }
  if (!files.codingGuidelines.trim()) problems.push("coding guidelines empty");

  const codes = [
    ...prompts.data.codes.map((code) => code.code),
    ...sequences.data.patterns.map((pattern) => pattern.code),
  ];
  const duplicates = codes.filter((code, i) => codes.indexOf(code) !== i);
  if (duplicates.length > 0) {
    problems.push(`codes used twice: ${duplicates.join(", ")}`);
  }

  const groupByCode = new Map<string, BehaviourGroup>();
  for (const g of grouping.data.groups) {
    for (const code of g.behaviourCodes) {
      if (!codes.includes(code)) {
        problems.push(`group ${g.code}: unknown code ${code}`);
      } else if (groupByCode.has(code)) {
        problems.push(`code ${code} is in more than one group`);
      }
      groupByCode.set(code, g);
    }
    const hasTexts = g.intro !== null && g.questions.length > 0;
    if (g.kind === "none" && (g.intro !== null || g.questions.length > 0)) {
      problems.push(`group ${g.code}: a "none" group has no texts`);
    } else if (g.kind !== "none" && !hasTexts) {
      problems.push(`group ${g.code}: needs an intro and a question`);
    }
    const standalone = g.kind === "general" || g.kind === "no_transcript";
    if (standalone && g.behaviourCodes.length > 0) {
      problems.push(`group ${g.code}: cannot have behaviour codes`);
    }
    // Bracketed parts are filled in per student, which happens only for the intro
    // and questions of groups tied to behaviour.
    const asWritten = standalone ? [g.intro, ...g.questions, g.tip] : [g.tip];
    if (asWritten.some((text) => text && /[[\]]/.test(text))) {
      problems.push(`group ${g.code}: brackets in a text shown as written`);
    }
  }
  for (const code of codes) {
    if (!groupByCode.has(code)) problems.push(`code ${code} is in no group`);
  }

  const ofKind = (kind: BehaviourGroup["kind"]) =>
    grouping.data.groups.filter((g) => g.kind === kind);
  const general = ofKind("general");
  if (general.length !== 1) problems.push("needs exactly one general group");
  const noTranscript = ofKind("no_transcript");
  if (noTranscript.length !== 1) {
    problems.push("needs exactly one no_transcript group");
  }

  if (problems.length > 0) throw new AnalysisError("S2-FRAMEWORK", problems);

  return {
    status,
    version,
    isTest: status === TEST_STATUS,
    icapCategories: prompts.data.icapCategories,
    promptCodes: prompts.data.codes,
    sequencePatterns: sequences.data.patterns,
    groups: grouping.data.groups,
    groupByCode,
    generalGroup: general[0],
    noTranscriptGroup: noTranscript[0] ?? null,
    codingGuidelines: files.codingGuidelines.trim(),
    reflectionGuidelines: files.reflectionGuidelines?.trim() || null,
  };
}

// Every group except "none" has texts; parseFramework guarantees it.
export function textsOf(group: BehaviourGroup): ReflectionTexts {
  if (group.intro === null || group.questions.length === 0) {
    throw new AnalysisError("S2-FRAMEWORK", [`group ${group.code}: no texts`]);
  }
  return { intro: group.intro, questions: group.questions, tip: group.tip };
}

// Research data must never be produced with a TEST framework.
export function assertFrameworkAllowed(
  framework: Framework,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (framework.isTest && env.VERCEL_ENV === "production") {
    throw new AnalysisError("S2-TEST-FRAMEWORK");
  }
}

function issues(
  file: string,
  result: { success: boolean; error?: z.ZodError },
): string[] {
  return (result.error?.issues ?? []).map(
    (issue) => `${file}: ${issue.path.join(".") || "(root)"} ${issue.message}`,
  );
}
