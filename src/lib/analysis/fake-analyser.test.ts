import { describe, expect, it } from "vitest";

import { codingSchema, validateCoding } from "./coding";
import { createFakeAnalyser } from "./fake-analyser";
import {
  reflectionCandidates,
  reflectionSchema,
  validateReflection,
} from "./reflection";
import { sampleTranscript, testFramework } from "./test-fixtures";

const framework = testFramework();
const fake = createFakeAnalyser();

async function fakeCoding(transcript = sampleTranscript()) {
  const { output } = await fake.code({} as never, { framework, transcript });
  const parsed = codingSchema(framework).parse(output);
  return validateCoding(parsed, transcript);
}

// The fake must pass the same checks as OpenAI, or the local flow would fail
// where the real one wouldn't.
describe("the fake analyser", () => {
  it("produces a coding that passes validation", async () => {
    const result = await fakeCoding();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.value.prompts.map((p) => p.codes.map((c) => c.code)),
      ).toEqual([["C5"], ["P3"], ["A3"], []]);
      expect(result.value.sequences).toHaveLength(1);
    }
  });

  it("gives a prompt several codes when several keywords match", async () => {
    const transcript = sampleTranscript();
    transcript.messages[2].text = "Varför fungerar inte sensorn?";
    const result = await fakeCoding(transcript);
    expect(
      result.ok && result.value.prompts[1].codes.map((c) => c.code),
    ).toEqual(["A3", "P3"]);
  });

  it("quotes long messages and messages around images word for word", async () => {
    const transcript = sampleTranscript();
    transcript.messages[0].text = `${"lång mening ".repeat(20)}[PICTURE] slut`;
    transcript.messages[2].text = "Titta här [PICTURE] och här";
    expect((await fakeCoding(transcript)).ok).toBe(true);
  });

  it("chooses varied observations that pass validation", async () => {
    const coding = await fakeCoding();
    if (!coding.ok) throw new Error("fake coding invalid");
    const candidates = reflectionCandidates(coding.value, framework);
    const { output } = await fake.reflect({} as never, {
      candidates,
      maxObservations: 3,
    });
    const parsed = reflectionSchema(3).parse(output);
    const result = validateReflection(parsed, candidates, framework, 3);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const groups = result.value.items.map((item) => item.group);
      expect(groups).toHaveLength(3);
      expect(new Set(groups).size).toBe(3);
      expect(result.value.items[0]).toMatchObject({
        groupKind: "reflect",
        // The brackets are gone: the fake keeps the first alternative.
        intro: "FAKE: Here you did this (R2).",
        questions: ["What made you do it (R2)?", "Second question (R2)?"],
      });
    }
  });
});
