import { describe, expect, it } from "vitest";

import type { Coding } from "@/lib/analysis/types";

import { icapCounts, promptCodeLevels } from "./icap-counts";

const levels = promptCodeLevels({
  promptCodes: [
    { code: "P2", name: "Passiv", level: "P" },
    { code: "A6", name: "Aktiv", level: "A" },
    { code: "C10", name: "Konstruktiv", level: "C" },
    { code: "NA3", name: "Ej tillämplig", level: "NA" },
    { code: "I9", name: "Interaktiv", level: "I" },
    { code: "X1", name: "Utan nivå" },
  ],
});

function coding(prompts: string[][]): Pick<Coding, "prompts"> {
  return {
    prompts: prompts.map((codes, index) => ({
      message: index * 2 + 1,
      codes: codes.map((code) => ({ code, excerpt: "x", justification: "x" })),
      note: null,
    })),
  };
}

describe("icapCounts", () => {
  it("counts every prompt code at its level and skips NA codes", () => {
    expect(
      icapCounts(coding([["P2", "C10"], ["A6"], ["NA3"], [], ["P2"]]), levels),
    ).toEqual({ P: 2, A: 1, C: 1 });
  });

  it("does not count Interactive", () => {
    expect(icapCounts(coding([["I9", "C10"]]), levels)).toEqual({
      P: 0,
      A: 0,
      C: 1,
    });
  });

  it("ignores codes without a level or missing from the framework", () => {
    expect(icapCounts(coding([["X1", "Z9"]]), levels)).toEqual({
      P: 0,
      A: 0,
      C: 0,
    });
  });
});
