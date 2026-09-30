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

describe("reflectionCandidates", () => {
  it("offers coded prompts and sequences, each with its group", () => {
    expect(
      candidates.map((c) => [c.id, c.code, c.group.code, c.group.kind]),
    ).toEqual([
      ["p1", "C5", "F2", "reinforce"],
      ["p3", "P3", "R2", "reflect"],
      ["p5", "A3", "F6", "reinforce"],
      ["s1", "S1", "F8", "reinforce"],
    ]);
  });

  it("never offers NA codes or uncodable prompts", () => {
    const withNa = coding();
    withNa.prompts[0].code = "NA3";
    const ids = reflectionCandidates(withNa, framework).map((c) => c.id);
    expect(ids).not.toContain("p1");
    expect(ids).not.toContain("p7");
  });
});

describe("validateReflection", () => {
  const choose = (observations: RawReflection["observations"]) =>
    validateReflection(
      { observations, generalQuestion: null },
      candidates,
      framework,
      3,
    );

  it("builds items from the validated coding, not from the model's words", () => {
    const result = choose([
      {
        candidate: "p3",
        explanation: "Du bad om felet.",
        question: "Vad trodde du?",
      },
      { candidate: "s1", explanation: "Du tog över.", question: "Vad hände?" },
    ]);
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
            question: "Vad trodde du?",
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
    if (result.ok) {
      expect(result.value.items[0].template).toBe("[TEST] Question for R2?");
    }
  });

  it("rejects unknown, repeated or empty choices", () => {
    expect(
      choose([{ candidate: "p9", explanation: "x", question: "y" }]),
    ).toEqual({ ok: false, problems: ["observation 1: unknown candidate"] });
    expect(
      choose([
        { candidate: "p3", explanation: "x", question: "y" },
        { candidate: "p3", explanation: "x", question: "y" },
      ]),
    ).toEqual({ ok: false, problems: ["p3: chosen twice"] });
    expect(
      choose([{ candidate: "p3", explanation: " ", question: "y" }]),
    ).toEqual({ ok: false, problems: ["p3: explanation missing or too long"] });
  });

  it("rejects more observations than configured", () => {
    const four = ["p1", "p3", "p5", "s1"].map((candidate) => ({
      candidate,
      explanation: "x",
      question: "y",
    }));
    expect(choose(four)).toMatchObject({
      ok: false,
      problems: ["more than 3 observations"],
    });
  });

  it("records a general question as insufficient evidence, not as a failure", () => {
    const result = validateReflection(
      { observations: [], generalQuestion: "Vad tänkte du mest själv på?" },
      candidates,
      framework,
      3,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        outcome: "insufficient_evidence",
        items: [
          {
            group: "R0",
            groupKind: "general",
            excerpt: null,
            question: "Vad tänkte du mest själv på?",
          },
        ],
      },
    });
    expect(
      validateReflection(
        { observations: [], generalQuestion: null },
        candidates,
        framework,
        3,
      ),
    ).toEqual({
      ok: false,
      problems: ["no observations and no usable general question"],
    });
  });
});

describe("generalReflection", () => {
  it("uses the general group's question as written", () => {
    const reflection = generalReflection(framework);
    expect(reflection.items[0].question).toBe(framework.generalGroup.question);
  });
});

describe("reflectionSchema", () => {
  it("limits the number of observations; validation checks the IDs", () => {
    const schema = reflectionSchema(2);
    const pick = (ids: string[]) =>
      schema.safeParse({
        observations: ids.map((candidate) => ({
          candidate,
          explanation: "x",
          question: "y",
        })),
        generalQuestion: null,
      }).success;
    expect(pick(["p1", "s1"])).toBe(true);
    expect(pick(["p1", "p3", "p5"])).toBe(false);
  });
});
