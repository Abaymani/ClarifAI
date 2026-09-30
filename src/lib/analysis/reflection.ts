import { z } from "zod";

import type { Validated } from "./coding";
import {
  textsOf,
  type BehaviourGroup,
  type Framework,
  type ReflectionTexts,
} from "./framework";
import type { Coding, ReflectionItem, ReflectionQuestions } from "./types";

const MAX_TEXT_LENGTH = 800;

export type Candidate = {
  // "p<message>-<code>" for a coded prompt, "s<n>" for the nth sequence.
  id: string;
  kind: "prompt" | "sequence";
  code: string;
  // Rank among the prompt's codes, 1 being the most important; 1 for sequences.
  priority: number;
  group: BehaviourGroup & { kind: "reflect" | "reinforce" };
  texts: ReflectionTexts;
  firstMessage: number;
  lastMessage: number;
  excerptMessage: number;
  excerpt: string;
  justification: string;
};

// Only behaviour whose group reflects or reinforces can be shown to the student;
// NA codes (group RN) and uncodable prompts never are.
export function reflectionCandidates(
  coding: Coding,
  framework: Framework,
): Candidate[] {
  const shown = (code: string) => {
    const group = framework.groupByCode.get(code);
    return group && (group.kind === "reflect" || group.kind === "reinforce")
      ? { group: group as Candidate["group"], texts: textsOf(group) }
      : null;
  };

  const candidates: Candidate[] = [];
  for (const prompt of coding.prompts) {
    prompt.codes.forEach((coded, i) => {
      const group = shown(coded.code);
      if (!group) return;
      candidates.push({
        id: `p${prompt.message}-${coded.code}`,
        kind: "prompt",
        code: coded.code,
        priority: i + 1,
        ...group,
        firstMessage: prompt.message,
        lastMessage: prompt.message,
        excerptMessage: prompt.message,
        excerpt: coded.excerpt,
        justification: coded.justification,
      });
    });
  }
  coding.sequences.forEach((sequence, i) => {
    const group = shown(sequence.pattern);
    if (!group) return;
    candidates.push({
      id: `s${i + 1}`,
      kind: "sequence",
      code: sequence.pattern,
      priority: 1,
      ...group,
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
          intro: z.string(),
          questions: z.array(z.string()),
        }),
      )
      .max(maxObservations),
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
    return { ok: true, value: generalReflection(framework) };
  }

  const problems: string[] = [];
  if (raw.observations.length > maxObservations) {
    problems.push(`more than ${maxObservations} observations`);
  }
  const byId = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const chosen = new Set<string>();
  const prompts = new Set<number>();
  const items: ReflectionItem[] = [];

  raw.observations.forEach((observation, i) => {
    const candidate = byId.get(observation.candidate);
    if (!candidate) {
      problems.push(`observation ${i + 1}: unknown candidate`);
      return;
    }
    if (chosen.has(candidate.id))
      problems.push(`${candidate.id}: chosen twice`);
    chosen.add(candidate.id);
    // Two examples showing the same prompt would only repeat each other.
    if (candidate.kind === "prompt") {
      if (prompts.has(candidate.firstMessage)) {
        problems.push(`${candidate.id}: its prompt is already chosen`);
      }
      prompts.add(candidate.firstMessage);
    }

    const intro = observation.intro.trim();
    const questions = observation.questions.map((question) => question.trim());
    if (!fitted(intro)) problems.push(`${candidate.id}: intro not usable`);
    if (questions.length !== candidate.texts.questions.length) {
      problems.push(
        `${candidate.id}: ${questions.length} questions, the group has ${candidate.texts.questions.length}`,
      );
    }
    if (!questions.every(fitted)) {
      problems.push(`${candidate.id}: a question is not usable`);
    }

    items.push({
      id: `q${i + 1}`,
      group: candidate.group.code,
      groupKind: candidate.group.kind,
      basedOn: {
        kind: candidate.kind,
        code: candidate.code,
        firstMessage: candidate.firstMessage,
        lastMessage: candidate.lastMessage,
      },
      // Taken from the validated coding, so the student sees their own words.
      excerpt: { message: candidate.excerptMessage, text: candidate.excerpt },
      intro,
      questions,
      tip: candidate.texts.tip,
      template: {
        intro: candidate.texts.intro,
        questions: candidate.texts.questions,
      },
    });
  });

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: { outcome: "observations", items } };
}

// A fitted text has content, a sensible length, and no [bracketed part] left
// over from the researchers' template.
function fitted(text: string): boolean {
  return (
    text.length > 0 && text.length <= MAX_TEXT_LENGTH && !/[[\]]/.test(text)
  );
}

// Used when the transcript supports no specific observation: the general group's
// texts, exactly as the researchers wrote them.
export function generalReflection(framework: Framework): ReflectionQuestions {
  const general = framework.generalGroup;
  const texts = textsOf(general);
  return {
    outcome: "insufficient_evidence",
    items: [
      {
        id: "q1",
        group: general.code,
        groupKind: "general",
        basedOn: null,
        excerpt: null,
        intro: texts.intro,
        questions: texts.questions,
        tip: texts.tip,
        template: { intro: texts.intro, questions: texts.questions },
      },
    ],
  };
}
