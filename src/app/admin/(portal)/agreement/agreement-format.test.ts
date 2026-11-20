import { describe, expect, test } from "vitest";

import { formatShortfall } from "@/app/admin/(portal)/agreement/agreement-format";

describe("formatShortfall", () => {
  test("gives q for both minimums", () => {
    expect(formatShortfall({ reliable: 1, tentative: 0.198 })).toBe(
      "q: 1,00 under 0,800 · 0,20 under 0,667",
    );
  });

  test("never rounds a share to 0 or 1 that isn't", () => {
    expect(formatShortfall({ reliable: 0.0005, tentative: 0 })).toBe(
      "q: < 0,01 under 0,800 · 0,00 under 0,667",
    );
    expect(formatShortfall({ reliable: 0.9995, tentative: 0.31 })).toBe(
      "q: > 0,99 under 0,800 · 0,31 under 0,667",
    );
  });
});
