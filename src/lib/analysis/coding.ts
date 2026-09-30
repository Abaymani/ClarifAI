import { z } from "zod";

import type { Transcript } from "@/lib/scraping/transcript";

import type { Framework } from "./framework";
import type { Coding, PromptCoding, SequenceCoding } from "./types";

export type Validated<T> =
  { ok: true; value: T } | { ok: false; problems: string[] };

// Enums built from the framework keep the model from inventing codes. Message
// numbers are plain numbers, checked by validateCoding.
export function codingSchema(framework: Framework) {
  const codes = framework.promptCodes.map((code) => code.code);
  const patterns = framework.sequencePatterns.map((pattern) => pattern.code);
  return z.object({
    prompts: z.array(
      z.object({
        message: z.number(),
        code: z.enum(codes as [string, ...string[]]).nullable(),
        excerpt: z.string(),
        justification: z.string(),
      }),
    ),
    sequences: z.array(
      z.object({
        pattern: z.enum(patterns as [string, ...string[]]),
        firstMessage: z.number(),
        lastMessage: z.number(),
        excerptMessage: z.number(),
        excerpt: z.string(),
        justification: z.string(),
      }),
    ),
  });
}

export type RawCoding = z.infer<ReturnType<typeof codingSchema>>;

// The requirements withhold results whose references don't hold, so every cited
// message must exist and every excerpt must really be in it. Problems name
// message numbers only, so they are safe to log.
export function validateCoding(
  raw: RawCoding,
  transcript: Transcript,
): Validated<Coding> {
  const problems: string[] = [];
  const messages = new Map(transcript.messages.map((m) => [m.index, m]));
  const coded = new Set<number>();
  const prompts: PromptCoding[] = [];

  for (const entry of raw.prompts) {
    const message = messages.get(entry.message);
    if (!message || message.role !== "student") {
      problems.push(`prompt ${entry.message}: not a student message`);
      continue;
    }
    if (coded.has(entry.message)) {
      problems.push(`prompt ${entry.message}: coded twice`);
      continue;
    }
    coded.add(entry.message);
    if (!entry.justification.trim()) {
      problems.push(`prompt ${entry.message}: no justification`);
    }
    const quoted = quotes(message.text, entry.excerpt);
    if (entry.code !== null && !quoted) {
      problems.push(`prompt ${entry.message}: excerpt not in the message`);
    }
    prompts.push({
      message: entry.message,
      code: entry.code,
      // An uncoded prompt needs no evidence, so a bad excerpt is dropped instead.
      excerpt: quoted ? entry.excerpt.trim() : "",
      justification: entry.justification.trim(),
    });
  }
  for (const message of transcript.messages) {
    if (message.role === "student" && !coded.has(message.index)) {
      problems.push(`prompt ${message.index}: not coded`);
    }
  }

  const sequences: SequenceCoding[] = [];
  raw.sequences.forEach((entry, i) => {
    const label = `sequence ${i + 1} (${entry.pattern})`;
    const inRange =
      messages.has(entry.firstMessage) &&
      messages.has(entry.lastMessage) &&
      entry.firstMessage <= entry.lastMessage;
    if (!inRange) {
      problems.push(
        `${label}: messages ${entry.firstMessage}–${entry.lastMessage} do not exist`,
      );
      return;
    }
    const excerptMessage = messages.get(entry.excerptMessage);
    if (
      !excerptMessage ||
      entry.excerptMessage < entry.firstMessage ||
      entry.excerptMessage > entry.lastMessage
    ) {
      problems.push(
        `${label}: excerpt message ${entry.excerptMessage} is outside the sequence`,
      );
    } else if (!quotes(excerptMessage.text, entry.excerpt)) {
      problems.push(`${label}: excerpt not in message ${entry.excerptMessage}`);
    }
    if (!entry.justification.trim())
      problems.push(`${label}: no justification`);
    sequences.push({
      ...entry,
      excerpt: entry.excerpt.trim(),
      justification: entry.justification.trim(),
    });
  });

  if (problems.length > 0) return { ok: false, problems };
  prompts.sort((a, b) => a.message - b.message);
  return { ok: true, value: { prompts, sequences } };
}

// Models tend to re-wrap lines, so whitespace is compared loosely; the words
// themselves must match exactly.
export function quotes(text: string, excerpt: string): boolean {
  const needle = normalise(excerpt);
  return needle.length > 0 && normalise(text).includes(needle);
}

function normalise(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}
