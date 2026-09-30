import { describe, expect, it } from "vitest";

import { codingSchema, quotes, validateCoding } from "./coding";
import { sampleCoding, sampleTranscript, testFramework } from "./test-fixtures";

const transcript = sampleTranscript();

function problems(mutate: (coding: ReturnType<typeof sampleCoding>) => void) {
  const coding = sampleCoding();
  mutate(coding);
  const result = validateCoding(coding, transcript);
  return result.ok ? [] : result.problems;
}

describe("validateCoding", () => {
  it("accepts a complete coding and keeps prompts in message order", () => {
    const coding = sampleCoding();
    coding.prompts.reverse();
    const result = validateCoding(coding, transcript);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prompts.map((p) => p.message)).toEqual([1, 3, 5, 7]);
      expect(result.value.sequences).toHaveLength(1);
    }
  });

  it("requires every student prompt to be coded exactly once", () => {
    expect(problems((c) => c.prompts.pop())).toEqual(["prompt 7: not coded"]);
    expect(problems((c) => c.prompts.push({ ...c.prompts[0] }))).toEqual([
      "prompt 1: coded twice",
    ]);
  });

  it("never codes Gemini's messages", () => {
    expect(problems((c) => (c.prompts[1].message = 2))).toEqual([
      "prompt 2: not a student message",
      "prompt 3: not coded",
    ]);
  });

  it("withholds codes whose excerpt is not in the message", () => {
    expect(
      problems((c) => (c.prompts[0].excerpt = "Vi vill bygga en robot.")),
    ).toEqual(["prompt 1: excerpt not in the message"]);
  });

  it("drops a loose excerpt on an uncoded prompt instead of failing", () => {
    const coding = sampleCoding();
    coding.prompts[3].excerpt = "something else";
    const result = validateCoding(coding, transcript);
    expect(result.ok && result.value.prompts[3].excerpt).toBe("");
  });

  it("requires a justification, also for uncoded prompts", () => {
    expect(problems((c) => (c.prompts[3].justification = " "))).toEqual([
      "prompt 7: no justification",
    ]);
  });

  it("checks that sequences point at real messages and quote one of them", () => {
    expect(problems((c) => (c.sequences[0].lastMessage = 12))).toEqual([
      "sequence 1 (S1): messages 3–12 do not exist",
    ]);
    expect(problems((c) => (c.sequences[0].excerptMessage = 1))).toEqual([
      "sequence 1 (S1): excerpt message 1 is outside the sequence",
    ]);
    expect(problems((c) => (c.sequences[0].excerpt = "Hittepå"))).toEqual([
      "sequence 1 (S1): excerpt not in message 5",
    ]);
  });

  it("keeps problems free of transcript content, so they can be logged", () => {
    const logged = problems((c) => {
      c.prompts[0].excerpt = "Vi vill bygga en robot.";
      c.prompts.pop();
    }).join(" ");
    expect(logged).not.toMatch(/robot|avståndslarm/i);
  });
});

describe("quotes", () => {
  it("ignores line breaks and spacing, but not the words", () => {
    const text = transcript.messages[0].text;
    expect(quotes(text, "pin 9, stämmer   det?")).toBe(true);
    expect(quotes(text, "pin 9,\nstämmer det?")).toBe(true);
    expect(quotes(text, "pin 10")).toBe(false);
    expect(quotes(text, "   ")).toBe(false);
  });
});

describe("codingSchema", () => {
  it("only accepts codes and patterns from the framework", () => {
    const schema = codingSchema(testFramework());
    expect(schema.safeParse(sampleCoding()).success).toBe(true);

    const invented = sampleCoding();
    invented.prompts[0].code = "Z9";
    expect(schema.safeParse(invented).success).toBe(false);
  });
});
