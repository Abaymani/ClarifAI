export type AnalysisErrorCode =
  | "S2-CONFIG"
  | "S2-FRAMEWORK"
  | "S2-TEST-FRAMEWORK"
  | "S2-TOO-LONG"
  | "S2-OPENAI"
  | "S2-OPENAI-TIMEOUT"
  | "S2-RATE-LIMIT"
  | "S2-REFUSAL"
  | "S2-INCOMPLETE"
  | "S2-INVALID-CODING"
  | "S2-INVALID-REFLECTION"
  | "S2-DB"
  | "S2-UNEXPECTED";

// Shown to the student while an analysis that was started never reported back,
// for example because the function running it hit its time limit.
export const INTERRUPTED_ANALYSIS = "S2-INTERRUPTED";
// Shown when a finished analysis is stored in a shape this version cannot read.
export const UNREADABLE_RESULT = "S2-RESULT";

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  // Safe to log: message numbers and codes only, never transcript content.
  readonly problems: string[];

  constructor(code: AnalysisErrorCode, problems: string[] = []) {
    super(code);
    this.name = "AnalysisError";
    this.code = code;
    this.problems = problems;
  }
}
