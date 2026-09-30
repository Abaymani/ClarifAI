import type { Analyser } from "./analyser";
import type { RawCoding } from "./coding";
import type { Candidate, RawReflection } from "./reflection";

// Stands in for OpenAI when there is no API key (local development, end-to-end
// tests). It codes by keyword so the flow can be tried end to end; its results are
// marked [FAKE] and stored with analyser "fake", so they are never research data.
const KEYWORD_CODES: [RegExp, string][] = [
  [/\bvarför\b|\bwhy\b/i, "A3"],
  [/\b(jag|vi) tror\b|\bmisstänker\b|\bi think\b/i, "C5"],
  [/fungerar inte|funkar inte|doesn'?t work|not working/i, "P3"],
  [/förklara|explain/i, "A1"],
  [/steg för steg|step by step/i, "P8"],
  [/\bkod(en)?\b|\bcode\b/i, "NA3"],
];
const FALLBACK_CODES = ["P2", "C2", "A4", "P1"];
const EXCERPT_LENGTH = 80;

export function createFakeAnalyser(): Analyser {
  return {
    name: "fake",
    model: null,
    reasoningEffort: null,

    async code(_prompt, { framework, transcript }) {
      const known = new Set(framework.promptCodes.map((code) => code.code));
      const students = transcript.messages.filter(
        (message) => message.role === "student",
      );

      const prompts: RawCoding["prompts"] = students.map((message, i) => {
        const excerpt = fakeExcerpt(message.text);
        if (!excerpt) {
          return {
            message: message.index,
            code: null,
            excerpt: "",
            justification: "[FAKE] Meddelandet har ingen text att koda.",
          };
        }
        const byKeyword = KEYWORD_CODES.find(([pattern]) =>
          pattern.test(message.text),
        )?.[1];
        const code = [byKeyword, FALLBACK_CODES[i % FALLBACK_CODES.length]]
          .concat([...known])
          .find((candidate) => candidate && known.has(candidate))!;
        return {
          message: message.index,
          code,
          excerpt,
          justification: "[FAKE] Kodat automatiskt utan AI, bara för test.",
        };
      });

      // One sequence over the whole chat, so sequences show up in the flow too.
      const first = students[0];
      const last = transcript.messages.at(-1);
      const excerpt = first ? fakeExcerpt(first.text) : "";
      const pattern = framework.sequencePatterns.some((p) => p.code === "S7")
        ? "S7"
        : null;
      const sequences: RawCoding["sequences"] =
        students.length >= 2 && first && last && excerpt && pattern
          ? [
              {
                pattern,
                firstMessage: first.index,
                lastMessage: last.index,
                excerptMessage: first.index,
                excerpt,
                justification: "[FAKE] Sekvens tillagd automatiskt för test.",
              },
            ]
          : [];

      return { output: { prompts, sequences }, usage: null };
    },

    async reflect(_prompt, { candidates, maxObservations }) {
      const chosen = pickVaried(candidates, maxObservations);
      const output: RawReflection = {
        observations: chosen.map((candidate) => ({
          candidate: candidate.id,
          explanation:
            "[FAKE] Förklaringen skrivs av AI när en API-nyckel finns.",
          question: candidate.group.question ?? "",
        })),
        generalQuestion: null,
      };
      return { output, usage: null };
    },
  };
}

// Reflection and reinforcement alternate, one per group, so the page shows both.
function pickVaried(candidates: Candidate[], max: number): Candidate[] {
  const chosen: Candidate[] = [];
  const groups = new Set<string>();
  const order = ["reflect", "reinforce"];
  for (
    let round = 0;
    chosen.length < max && round < candidates.length;
    round++
  ) {
    const kind = order[round % order.length];
    const next =
      candidates.find(
        (c) => c.group.kind === kind && !groups.has(c.group.code),
      ) ?? candidates.find((c) => !groups.has(c.group.code));
    if (!next) break;
    chosen.push(next);
    groups.add(next.group.code);
  }
  return chosen;
}

// Excerpts must appear word for word, so they never span an image placeholder.
function fakeExcerpt(text: string): string {
  const words =
    text
      .split("[PICTURE]")
      .map((part) => part.replace(/\s+/g, " ").trim())
      .find(Boolean) ?? "";
  if (words.length <= EXCERPT_LENGTH) return words;
  const cut = words.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}
