import { z } from "zod";

import type { Validated } from "./coding";
import type { BehaviourGroup, Framework } from "./framework";
import type { Coding, ReflectionItem, ReflectionQuestions } from "./types";

const MAX_TEXT_LENGTH = 600;

export type Candidate = {
  // "p<message>" for a prompt, "s<n>" for the nth sequence.
  id: string;
  kind: "prompt" | "sequence";
  code: string;
  group: BehaviourGroup;
  firstMessage: number;
  lastMessage: number;
  excerptMessage: number;
  excerpt: string;
  justification: string;
};

// Only coded behaviour with a question can be reflected on; NA codes (group RN)
// and uncodable prompts never can.
export function reflectionCandidates(
  coding: Coding,
  framework: Framework,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const prompt of coding.prompts) {
    const group = prompt.code ? framework.groupByCode.get(prompt.code) : null;
    if (!prompt.code || !group?.question || group.kind === "none") continue;
    candidates.push({
      id: `p${prompt.message}`,
      kind: "prompt",
      code: prompt.code,
      group,
      firstMessage: prompt.message,
      lastMessage: prompt.message,
      excerptMessage: prompt.message,
      excerpt: prompt.excerpt,
      justification: prompt.justification,
    });
  }
  coding.sequences.forEach((sequence, i) => {
    const group = framework.groupByCode.get(sequence.pattern);
    if (!group?.question || group.kind === "none") return;
    candidates.push({
      id: `s${i + 1}`,
      kind: "sequence",
      code: sequence.pattern,
      group,
      firstMessage: sequence.firstMessage,
      lastMessage: sequence.lastMessage,
      excerptMessage: sequence.excerptMessage,
      excerpt: sequence.excerpt,
      justification: sequence.justification,
    });
  });
  return candidates;
}

// The output format is part of what OpenAI caches, so it must not vary between
// students: candidate IDs are plain strings, checked by validateReflection.
export function reflectionSchema(maxObservations: number) {
  return z.object({
    observations: z
      .array(
        z.object({
          candidate: z.string(),
          explanation: z.string(),
          question: z.string(),
        }),
      )
      .max(maxObservations),
    generalQuestion: z.string().nullable(),
  });
}

export type RawReflection = z.infer<ReturnType<typeof reflectionSchema>>;

export function validateReflection(
  raw: RawReflection,
  candidates: Candidate[],
  framework: Framework,
  maxObservations: number,
): Validated<ReflectionQuestions> {
  if (raw.observations.length === 0) {
    const question = raw.generalQuestion?.trim() ?? "";
    if (!question || question.length > MAX_TEXT_LENGTH) {
      return {
        ok: false,
        problems: ["no observations and no usable general question"],
      };
    }
    return { ok: true, value: generalReflection(framework, question) };
  }

  const problems: string[] = [];
  if (raw.observations.length > maxObservations) {
    problems.push(`more than ${maxObservations} observations`);
  }
  const byId = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const chosen = new Set<string>();
  const items: ReflectionItem[] = [];
  raw.observations.forEach((observation, i) => {
    const candidate = byId.get(observation.candidate);
    const explanation = observation.explanation.trim();
    const question = observation.question.trim();
    if (!candidate) {
      problems.push(`observation ${i + 1}: unknown candidate`);
      return;
    }
    if (chosen.has(candidate.id))
      problems.push(`${candidate.id}: chosen twice`);
    chosen.add(candidate.id);
    if (!explanation || explanation.length > MAX_TEXT_LENGTH) {
      problems.push(`${candidate.id}: explanation missing or too long`);
    }
    if (!question || question.length > MAX_TEXT_LENGTH) {
      problems.push(`${candidate.id}: question missing or too long`);
    }
    items.push({
      id: `q${i + 1}`,
      group: candidate.group.code,
      groupKind: candidate.group.kind === "reinforce" ? "reinforce" : "reflect",
      basedOn: {
        kind: candidate.kind,
        code: candidate.code,
        firstMessage: candidate.firstMessage,
        lastMessage: candidate.lastMessage,
      },
      // Taken from the validated coding, so the student sees their own words.
      excerpt: { message: candidate.excerptMessage, text: candidate.excerpt },
      explanation,
      template: candidate.group.question ?? "",
      question,
    });
  });

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: { outcome: "observations", items } };
}

// Used when the transcript supports no specific observation. Without candidates the
// model isn't asked at all and the general question is used as written.
export function generalReflection(
  framework: Framework,
  question?: string,
): ReflectionQuestions {
  const general = framework.generalGroup;
  const template = general.question ?? "";
  return {
    outcome: "insufficient_evidence",
    items: [
      {
        id: "q1",
        group: general.code,
        groupKind: "general",
        basedOn: null,
        excerpt: null,
        explanation: null,
        template,
        question: question ?? template,
      },
    ],
  };
}
