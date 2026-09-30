import type { TranscriptMessage } from "@/lib/scraping/transcript";

// Students reflect better when they recognise the situation, so each example also
// shows the messages right before and after the quoted one.
export function surroundingMessages(
  messages: TranscriptMessage[],
  index: number,
): {
  before: TranscriptMessage | null;
  focus: TranscriptMessage;
  after: TranscriptMessage | null;
} | null {
  const position = messages.findIndex((message) => message.index === index);
  if (position === -1) return null;
  return {
    before: messages[position - 1] ?? null,
    focus: messages[position],
    after: messages[position + 1] ?? null,
  };
}

export type HighlightedText = {
  before: string;
  match: string | null;
  after: string;
  clippedStart: boolean;
  clippedEnd: boolean;
};

const LONG_MESSAGE = 400;
const AROUND_EXCERPT = 150;

// Long messages (pasted code, error logs) are cut around the excerpt so the quoted
// words stay in view. Excerpts were validated with loose whitespace, so they are
// found the same way here.
export function highlightExcerpt(
  text: string,
  excerpt: string,
): HighlightedText {
  const words = excerpt.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  const found =
    words.length > 0 ? new RegExp(words.join("\\s+")).exec(text) : null;

  if (!found) {
    const clipped = text.length > LONG_MESSAGE;
    return {
      before: clipped ? text.slice(0, wordEnd(text, LONG_MESSAGE)) : text,
      match: null,
      after: "",
      clippedStart: false,
      clippedEnd: clipped,
    };
  }

  const start = found.index;
  const end = start + found[0].length;
  // Marking a whole message adds nothing.
  if (!text.slice(0, start).trim() && !text.slice(end).trim()) {
    return {
      before: text,
      match: null,
      after: "",
      clippedStart: false,
      clippedEnd: false,
    };
  }
  const from =
    text.length > LONG_MESSAGE
      ? wordStart(text, start - AROUND_EXCERPT, start)
      : 0;
  const to =
    text.length > LONG_MESSAGE
      ? wordEnd(text, end + AROUND_EXCERPT, end)
      : text.length;
  return {
    before: text.slice(from, start),
    match: found[0],
    after: text.slice(end, to),
    clippedStart: from > 0,
    clippedEnd: to < text.length,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Cut points move to the nearest whitespace, never past the excerpt itself.
function wordStart(text: string, position: number, limit: number): number {
  if (position <= 0) return 0;
  const next = text.slice(position, limit).search(/\s/);
  return next === -1 ? position : position + next + 1;
}

function wordEnd(text: string, position: number, limit = 0): number {
  if (position >= text.length) return text.length;
  const cut = text.slice(limit, position).search(/\s\S*$/);
  return cut === -1 ? position : limit + cut;
}
