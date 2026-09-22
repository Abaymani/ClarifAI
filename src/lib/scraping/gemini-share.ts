import { parseShareLink, resolveShareId, shareUrl } from "./gemini-link";
import { ScrapeError } from "./scrape-error";
import {
  replaceMedia,
  type Transcript,
  type TranscriptMessage,
} from "./transcript";

// The share page loads its chat from this internal endpoint. It is undocumented, so the
// parser checks every field it relies on and fails loudly when Google changes the format.
const ENDPOINT = "https://gemini.google.com/_/BardChatUi/data/batchexecute";
const RPC_ID = "ujx1Bf";
const MAX_RESPONSE_CHARS = 5_000_000;
// Stored with each transcript so records parsed by older code can be found again.
export const PARSER_VERSION = 1;

// gRPC status codes that batchexecute reports for failed calls.
const GRPC_NOT_FOUND = 5;
const GRPC_PERMISSION_DENIED = 7;

// Fields of a student prompt that are empty for plain text. Anything found there
// (presumably an uploaded image or file) is not understood yet.
const PROMPT_EMPTY_FIELDS = [2, 5, 6, 7, 8, 9, 10];

type ScrapeOptions = { fetch?: typeof fetch; now?: () => Date };

export async function scrapeGeminiShare(
  link: string,
  options: ScrapeOptions = {},
): Promise<Transcript> {
  const fetchImpl = options.fetch ?? fetch;
  const shareId = await resolveShareId(parseShareLink(link), fetchImpl);
  const payload = await fetchSharePayload(shareId, fetchImpl);
  return buildTranscript(payload, {
    submittedLink: link.trim(),
    shareId,
    retrievedAt: (options.now?.() ?? new Date()).toISOString(),
  });
}

export async function fetchSharePayload(
  shareId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  // Same arguments the share page sends; the trailing [4] is an undocumented flag.
  const body = new URLSearchParams({
    "f.req": JSON.stringify([
      [[RPC_ID, JSON.stringify([null, shareId, [4]]), null, "generic"]],
    ]),
  });

  let response: Response;
  try {
    response = await fetchImpl(`${ENDPOINT}?rpcids=${RPC_ID}&rt=c`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new ScrapeError("FETCH_FAILED", "Could not reach Gemini", {
      cause: error,
    });
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ScrapeError(
      "FETCH_FAILED",
      `Gemini answered with HTTP ${response.status}`,
    );
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_CHARS) {
    throw new ScrapeError(
      "TOO_LARGE",
      "The conversation is too large to store",
    );
  }
  return parseBatchExecuteResponse(text, RPC_ID);
}

export function parseBatchExecuteResponse(
  text: string,
  rpcId: string,
): unknown {
  // After an anti-hijacking prefix, every data line is a JSON array of entries.
  for (const line of text.split("\n")) {
    if (!line.startsWith("[[")) continue;
    let entries: unknown;
    try {
      entries = JSON.parse(line);
    } catch {
      continue;
    }
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (
        !Array.isArray(entry) ||
        entry[0] !== "wrb.fr" ||
        entry[1] !== rpcId
      ) {
        continue;
      }
      if (typeof entry[2] === "string") {
        try {
          return JSON.parse(entry[2]);
        } catch (error) {
          throw new ScrapeError(
            "UNEXPECTED_FORMAT",
            "The chat data is not valid JSON",
            {
              cause: error,
            },
          );
        }
      }
      const status = at(entry, 5, 0);
      if (status === GRPC_NOT_FOUND) {
        throw new ScrapeError(
          "NOT_FOUND",
          "The shared chat does not exist or has been deleted",
        );
      }
      if (status === GRPC_PERMISSION_DENIED) {
        throw new ScrapeError(
          "NOT_ACCESSIBLE",
          "The shared chat is not publicly accessible",
        );
      }
      throw new ScrapeError(
        "FETCH_FAILED",
        `Gemini reported an error (status ${String(status)})`,
      );
    }
  }
  throw new ScrapeError(
    "UNEXPECTED_FORMAT",
    "The response contains no chat data",
  );
}

type ParsedTurn = {
  sentAtMs: number | null;
  prompt: string;
  promptHasUnknownContent: boolean;
  answer: string;
  otherDrafts: string[];
  shownDraftKnown: boolean;
};

export function buildTranscript(
  payload: unknown,
  context: { submittedLink: string; shareId: string; retrievedAt: string },
): Transcript {
  const chat = expectArray(at(payload, 0), "the chat");
  const returnedId = chat[3];
  if (typeof returnedId === "string" && returnedId !== context.shareId) {
    throw new ScrapeError(
      "UNEXPECTED_FORMAT",
      "Gemini returned a different chat than requested",
    );
  }

  const rawTurns = expectArray(chat[1], "the list of turns");
  if (rawTurns.length === 0) {
    throw new ScrapeError(
      "EMPTY_TRANSCRIPT",
      "The shared chat has no messages",
    );
  }
  const turns = rawTurns.map(parseTurn);
  // Turns currently arrive oldest first; sorting keeps them chronological if that changes.
  if (turns.every((turn) => turn.sentAtMs !== null)) {
    turns.sort((a, b) => (a.sentAtMs ?? 0) - (b.sentAtMs ?? 0));
  }

  const warnings: string[] = [];
  const messages: TranscriptMessage[] = [];
  for (const turn of turns) {
    const promptIndex = messages.length + 1;
    let prompt = replaceMedia(turn.prompt, (kind) =>
      warnings.push(`Message ${promptIndex}: unsupported content (${kind}).`),
    );
    if (turn.promptHasUnknownContent) {
      prompt = `${prompt}\n[UNSUPPORTED CONTENT]`.trimStart();
      warnings.push(
        `Message ${promptIndex}: the prompt contains something the scraper does not recognise yet (probably an uploaded image or file).`,
      );
    }
    messages.push({
      index: promptIndex,
      role: "student",
      text: prompt,
      ...(turn.sentAtMs !== null
        ? { sentAt: new Date(turn.sentAtMs).toISOString() }
        : {}),
    });

    const answerIndex = messages.length + 1;
    const onUnsupported = (kind: string) =>
      warnings.push(`Message ${answerIndex}: unsupported content (${kind}).`);
    if (!turn.shownDraftKnown) {
      warnings.push(
        `Message ${answerIndex}: could not tell which draft was shown; used the first.`,
      );
    }
    const otherDrafts = turn.otherDrafts.map((draft) =>
      replaceMedia(draft, onUnsupported),
    );
    messages.push({
      index: answerIndex,
      role: "gemini",
      text: replaceMedia(turn.answer, onUnsupported),
      ...(otherDrafts.length > 0 ? { otherDrafts } : {}),
    });
  }

  const title = at(chat, 2, 1);
  const model = at(chat, 2, 7, 2);
  const sharedAtMs = toMillis(at(chat, 4));
  return {
    source: {
      submittedLink: context.submittedLink,
      shareUrl: shareUrl(context.shareId),
      title: typeof title === "string" && title !== "" ? title : null,
      model: typeof model === "string" && model !== "" ? model : null,
      sharedAt: sharedAtMs === null ? null : new Date(sharedAtMs).toISOString(),
    },
    retrievedAt: context.retrievedAt,
    parserVersion: PARSER_VERSION,
    messages,
    warnings,
  };
}

function parseTurn(raw: unknown, position: number): ParsedTurn {
  const where = `turn ${position + 1}`;
  const prompt = expectArray(at(raw, 2), `${where}: prompt`);
  const promptText = expectString(at(prompt, 0, 0), `${where}: prompt text`);

  const answer = expectArray(at(raw, 3), `${where}: answer`);
  const drafts = expectArray(answer[0], `${where}: answer drafts`);
  const shown = drafts.find((draft) => at(draft, 0) === answer[3]);
  const displayed = shown ?? drafts[0];
  const answerText = expectString(at(displayed, 1, 0), `${where}: answer text`);
  const otherDrafts = drafts
    .filter((draft) => draft !== displayed)
    .map((draft) => expectString(at(draft, 1, 0), `${where}: draft text`));

  return {
    sentAtMs: toMillis(at(raw, 4)),
    prompt: promptText,
    promptHasUnknownContent: PROMPT_EMPTY_FIELDS.some(
      (i) => !isEmpty(prompt[i]),
    ),
    answer: answerText,
    otherDrafts,
    shownDraftKnown: shown !== undefined,
  };
}

function at(value: unknown, ...path: number[]): unknown {
  let current = value;
  for (const index of path) {
    if (!Array.isArray(current)) return undefined;
    current = current[index];
  }
  return current;
}

function expectArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw unexpectedFormat(what);
  return value;
}

function expectString(value: unknown, what: string): string {
  if (typeof value !== "string") throw unexpectedFormat(what);
  return value;
}

function unexpectedFormat(what: string): ScrapeError {
  return new ScrapeError(
    "UNEXPECTED_FORMAT",
    `Gemini's chat data has changed: ${what} is missing`,
  );
}

function isEmpty(value: unknown): boolean {
  return value == null || (Array.isArray(value) && value.length === 0);
}

// Gemini stores times as [seconds, nanoseconds].
function toMillis(value: unknown): number | null {
  const seconds = at(value, 0);
  const nanos = at(value, 1);
  if (typeof seconds !== "number") return null;
  return (
    seconds * 1000 + (typeof nanos === "number" ? Math.floor(nanos / 1e6) : 0)
  );
}
