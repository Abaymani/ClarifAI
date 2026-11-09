import { describe, expect, test } from "vitest";

import {
  calculateCoderAgreement,
  type AgreementSessionInput,
} from "@/lib/admin/coder-agreement";
import {
  applyFrameworkChanges,
  frameworkChangesProblem,
  mergedCode,
  type FrameworkChange,
} from "@/lib/admin/framework-changes";

const framework = {
  promptCodes: [
    { code: "NA1", name: "Ej relevant", level: "NA" },
    { code: "P1", name: "Beslutsdelegation", level: "P" },
    { code: "P2", name: "Faktafråga", level: "P" },
    { code: "A2", name: "Beslutsdelegation", level: "A" },
    { code: "C3", name: "Förklaring", level: "C" },
    { code: "C10", name: "Strategisk hjälpsökning", level: "C" },
  ],
};

const session: AgreementSessionInput = {
  sessionId: "730_2",
  participantCode: "730",
  lesson: 2,
  prompts: [1, 3],
  coding: {
    R1: [
      { message: 1, codes: ["A2", "C3"] },
      { message: 3, codes: ["P2"] },
    ],
    // Frida's only code is one that gets deleted.
    R2: [{ message: 1, codes: ["C10"] }],
    AI: [{ message: 1, codes: ["P1"] }],
  },
};

describe("frameworkChangesProblem", () => {
  test("accepts merges across levels and deletions", () => {
    expect(
      frameworkChangesProblem(
        [
          { kind: "merge", codes: ["P1", "A2"], level: "P" },
          { kind: "delete", code: "C10" },
        ],
        framework,
      ),
    ).toBeNull();
  });

  test("names what is wrong with the changes", () => {
    const problem = (changes: FrameworkChange[]) =>
      frameworkChangesProblem(changes, framework);

    expect(problem([])).toBe("Lägg till minst en ändring.");
    expect(problem([{ kind: "delete", code: "NA1" }])).toBe(
      "NA1 är ingen P-, A- eller C-kod i ramverket.",
    );
    expect(problem([{ kind: "delete", code: "X9" }])).toBe(
      "X9 är ingen P-, A- eller C-kod i ramverket.",
    );
    expect(
      problem([
        { kind: "merge", codes: ["P1", "A2"], level: "A" },
        { kind: "delete", code: "P1" },
      ]),
    ).toBe("P1 ingår i mer än en ändring.");
    expect(problem([{ kind: "merge", codes: ["P1"], level: "P" }])).toBe(
      "En sammanslagning behöver minst två koder.",
    );
    expect(problem([{ kind: "merge", codes: ["C3", "C10"], level: "P" }])).toBe(
      "C3 + C10 ligger alla på nivå C.",
    );
    expect(
      problem(
        Array.from({ length: 31 }, () => ({
          kind: "delete" as const,
          code: "P2",
        })),
      ),
    ).toBe("Högst 30 ändringar åt gången.");
  });
});

describe("applyFrameworkChanges", () => {
  const changes: FrameworkChange[] = [
    { kind: "merge", codes: ["A2", "P1"], level: "P" },
    { kind: "delete", code: "C10" },
  ];

  test("names a merged code after its codes in framework order", () => {
    expect(mergedCode(["A2", "P1"], framework)).toBe("P1+A2");
  });

  test("changes a copy of the framework and the coding", () => {
    const changed = applyFrameworkChanges([session], framework, changes);

    expect(changed.framework.promptCodes).toEqual([
      { code: "NA1", name: "Ej relevant", level: "NA" },
      { code: "P1+A2", name: "Beslutsdelegation", level: "P" },
      { code: "P2", name: "Faktafråga", level: "P" },
      { code: "C3", name: "Förklaring", level: "C" },
    ]);
    expect(changed.sessions[0].coding).toEqual({
      R1: [
        { message: 1, codes: ["P1+A2", "C3"] },
        { message: 3, codes: ["P2"] },
      ],
      // A deleted code stays in the copy, where the framework no longer knows it.
      R2: [{ message: 1, codes: ["C10"] }],
      AI: [{ message: 1, codes: ["P1+A2"] }],
    });
    // The originals are untouched.
    expect(session.coding.R1[0].codes).toEqual(["A2", "C3"]);
    expect(framework.promptCodes).toHaveLength(6);
  });

  test("keeps a coder whose only codes are deleted as having coded", () => {
    const changed = applyFrameworkChanges([session], framework, changes);
    const agreement = calculateCoderAgreement(
      changed.sessions,
      changed.framework,
    );

    expect(agreement.transcripts[0].coders).toEqual(["R1", "R2", "AI"]);
    // Armin's merged code now matches the AI's on prompt 1, on the merged level.
    const aiArmin = agreement.variants[0].pairs.find(
      (pair) => pair.pair === "AI-R1",
    );
    expect(aiArmin?.perCode.find((code) => code.category === "P1+A2")).toEqual({
      category: "P1+A2",
      alpha: expect.any(Number),
      both: 1,
      onlyFirst: 0,
      onlySecond: 0,
    });
  });
});
