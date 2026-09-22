export type ScrapeErrorCode =
  | "INVALID_LINK"
  | "NOT_FOUND"
  | "NOT_ACCESSIBLE"
  | "FETCH_FAILED"
  | "UNEXPECTED_FORMAT"
  | "EMPTY_TRANSCRIPT"
  | "TOO_LARGE";

// Messages never include transcript content, so errors are safe to log and store.
export class ScrapeError extends Error {
  readonly code: ScrapeErrorCode;

  constructor(code: ScrapeErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ScrapeError";
    this.code = code;
  }
}
