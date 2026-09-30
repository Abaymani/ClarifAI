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
  analyser: "openai" | "fake";
  model: string | null;
  reasoningEffort: string | null;
  // ISO time the result was produced; measuring waits is part of the evaluation.
  createdAt: string;
  durationMs: number;
  usage: Usage | null;
};

export type PromptCoding = {
  message: number;
  // null when the transcript gave too little context; `justification` says why.
  code: string | null;
  excerpt: string;
  justification: string;
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
  groupKind: "reflect" | "reinforce" | "general";
  basedOn: {
    kind: "prompt" | "sequence";
    code: string;
    firstMessage: number;
    lastMessage: number;
  } | null;
  excerpt: { message: number; text: string } | null;
  explanation: string | null;
  // The group's question before adaptation, kept for the research record.
  template: string;
  question: string;
};

export type ReflectionQuestions = {
  // `insufficient_evidence` is a successful analysis without suitable examples,
  // which the requirements ask to record apart from failures.
  outcome: "observations" | "insufficient_evidence";
  items: ReflectionItem[];
};

export type StoredReflectionQuestions = AnalysisRun & ReflectionQuestions;
