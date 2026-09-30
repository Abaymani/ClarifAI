import { describe, expect, it } from "vitest";

import { validateCoding } from "./coding";
import {
  generalReflection,
  reflectionCandidates,
  reflectionSchema,
  validateReflection,
  type RawReflection,
} from "./reflection";
import { sampleCoding, sampleTranscript, testFramework } from "./test-fixtures";

const framework = testFramework();

function coding() {
  const result = validateCoding(sampleCoding(), sampleTranscript());
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.value;
}

const candidates = reflectionCandidates(coding(), framework);

// What the model returns for a candidate: the group's texts without brackets.
const fit = (candidate: string, questions = 2) => ({
  candidate,
  intro: "Här bad du Gemini hitta felet.",
  questions: Array.from({ length: questions }, (_, i) => `Fråga ${i + 1}?`),
});

describe("reflectionCandidates", () => {
  it("offers every code of a prompt, and sequences, each with its group", () => {
    expect(
      candidates.map((c) => [c.id, c.group.code, c.group.kind, c.priority]),
    ).toEqual([
      ["p1-C5", "F2", "reinforce", 1],
      ["p1-C2", "F1", "reinforce", 2],
      ["p3-P3", "R2", "reflect", 1],
      ["p5-A3", "F6", "reinforce", 1],
      ["s1", "F8", "reinforce", 1],
    ]);
  });

  it("never offers NA codes or uncodable prompts", () => {
    const withNa = coding();
    withNa.prompts[0].codes[0].code = "NA3";
    const ids = reflectionCandidates(withNa, framework).map((c) => c.id);
    expect(ids).toEqual(["p1-C2", "p3-P3", "p5-A3", "s1"]);
  });
});

describe("validateReflection", () => {
  const choose = (observations: RawReflection["observations"]) =>
    validateReflection({ observations }, candidates, framework, 3);

  it("builds items from the validated coding and the group's texts", () => {
    const result = choose([fit("p3-P3"), fit("s1")]);
    expect(result).toMatchObject({
      ok: true,
      value: {
        outcome: "observations",
        items: [
          {
            id: "q1",
            group: "R2",
            groupKind: "reflect",
            basedOn: {
              kind: "prompt",
              code: "P3",
              firstMessage: 3,
              lastMessage: 3,
            },
            excerpt: { message: 3, text: "Det fungerar inte, vad är fel?" },
            intro: "Här bad du Gemini hitta felet.",
            questions: ["Fråga 1?", "Fråga 2?"],
            // Shown as the researchers wrote it, and kept with the originals.
            tip: "I did it because … (R2)",
            template: {
              intro: "Here you [did this / did that] (R2).",
              questions: [
                "What made you [do it] (R2)?",
                "Second question (R2)?",
              ],
            },
          },
          {
            id: "q2",
            group: "F8",
            groupKind: "reinforce",
            basedOn: {
              kind: "sequence",
              code: "S1",
              firstMessage: 3,
              lastMessage: 5,
            },
          },
        ],
      },
    });
  });

  it("rejects unknown and repeated choices", () => {
    expect(choose([fit("p9-P3")])).toEqual({
      ok: false,
      problems: ["observation 1: unknown candidate"],
    });
    expect(choose([fit("p3-P3"), fit("p3-P3")])).toMatchObject({
      ok: false,
      problems: expect.arrayContaining(["p3-P3: chosen twice"]),
    });
  });

  it("shows a prompt in one example only, even if it has several codes", () => {
    expect(choose([fit("p1-C5"), fit("p1-C2")])).toEqual({
      ok: false,
      problems: ["p1-C2: its prompt is already chosen"],
    });
  });

  it("wants every question of the group, with no brackets left", () => {
    expect(choose([fit("p3-P3", 1)])).toEqual({
      ok: false,
      problems: ["p3-P3: 1 questions, the group has 2"],
    });
    expect(
      choose([{ ...fit("p3-P3"), intro: "Här [fungerade något inte]." }]),
    ).toEqual({ ok: false, problems: ["p3-P3: intro not usable"] });
    expect(
      choose([{ ...fit("p3-P3"), questions: ["Vad gjorde [ämnet]?", " "] }]),
    ).toEqual({ ok: false, problems: ["p3-P3: a question is not usable"] });
  });

  it("rejects more observations than configured", () => {
    expect(
      choose(["p1-C5", "p3-P3", "p5-A3", "s1"].map((id) => fit(id))),
    ).toMatchObject({ ok: false, problems: ["more than 3 observations"] });
  });

  it("records no chosen observations as insufficient evidence, not as a failure", () => {
    expect(choose([])).toEqual({
      ok: true,
      value: generalReflection(framework),
    });
  });
});

describe("generalReflection", () => {
  it("uses the general group's texts exactly as written", () => {
    expect(generalReflection(framework)).toEqual({
      outcome: "insufficient_evidence",
      items: [
        {
          id: "q1",
          group: "R0",
          groupKind: "general",
          basedOn: null,
          excerpt: null,
          intro: "Intro R0.",
          questions: ["General question (R0)?"],
          tip: "I did it because … (R0)",
          template: {
            intro: "Intro R0.",
            questions: ["General question (R0)?"],
          },
        },
      ],
    });
  });
});

describe("reflectionSchema", () => {
  it("limits the number of observations; validation checks the rest", () => {
    const schema = reflectionSchema(2);
    const pick = (ids: string[]) =>
      schema.safeParse({ observations: ids.map((id) => fit(id)) }).success;
    expect(pick(["p1-C5", "s1"])).toBe(true);
    expect(pick(["p1-C5", "p3-P3", "p5-A3"])).toBe(false);
  });
});
