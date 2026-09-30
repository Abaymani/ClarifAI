// What the analysis stores in the session document. The coding is research data
// that will be compared with human coders, so it is kept exactly as validated.

export type Usage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
};

export type AnalysisRun = {
  frameworkVersion: string;
  frameworkStatus: string;
  // `none` is used for the R01 reflection, which is selected directly by the
  // student and does not run transcript analysis.
  analyser: "openai" | "fake" | "none";
  model: string | null;
  reasoningEffort: string | null;
  // ISO time the result was produced; measuring waits is part of the evaluation.
  createdAt: string;
  durationMs: number;
  usage: Usage | null;
};

export type CodedBehaviour = {
  code: string;
  excerpt: string;
  justification: string;
};

export type PromptCoding = {
  message: number;
  // In priority order, most important first (DL-039). Empty when the transcript
  // gave too little context to code the prompt; `note` then says why.
  codes: CodedBehaviour[];
  note: string | null;
};

export type SequenceCoding = {
  pattern: string;
  firstMessage: number;
  lastMessage: number;
  excerptMessage: number;
  excerpt: string;
  justification: string;
};

export type Coding = {
  prompts: PromptCoding[];
  sequences: SequenceCoding[];
};

export type StoredCoding = AnalysisRun & Coding;

export type ReflectionItem = {
  id: string;
  group: string;
  groupKind: "reflect" | "reinforce" | "general" | "no_transcript";
  basedOn: {
    kind: "prompt" | "sequence";
    code: string;
    firstMessage: number;
    lastMessage: number;
  } | null;
  excerpt: { message: number; text: string } | null;
  // The group's intro (or feedback) and questions, fitted to what the student did.
  intro: string;
  questions: string[];
  // A sentence starter for the student's answer, shown as the researchers wrote it.
  tip: string | null;
  // The texts before they were fitted, kept for the research record.
  template: { intro: string; questions: string[] };
};

export type ReflectionQuestions = {
  // `insufficient_evidence` is a successful analysis without suitable examples,
  // which the requirements ask to record apart from failures.
  outcome: "observations" | "insufficient_evidence" | "no_transcript";
  items: ReflectionItem[];
};

export type StoredReflectionQuestions = AnalysisRun & ReflectionQuestions;
