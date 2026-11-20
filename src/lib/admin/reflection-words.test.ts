import { describe, expect, it } from "vitest";

import {
  countWords,
  formatWords,
  totalWords,
} from "@/lib/admin/reflection-words";

describe("countWords", () => {
  it("counts text between whitespace", () => {
    expect(countWords("Jag bad AI:n förklara koden.")).toBe(5);
    expect(countWords("  två\n\nrader\tmed tabb ")).toBe(4);
  });

  it("counts hyphenated words, numbers and Swedish letters once each", () => {
    expect(countWords("AI-verktyg år 2026 är också ett ord")).toBe(7);
  });

  it("skips chunks without a letter or digit", () => {
    expect(countWords("Bra – men 🙂 inte ... perfekt ?")).toBe(4);
  });

  it("gives 0 for an empty answer", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n ")).toBe(0);
  });
});

describe("totalWords", () => {
  it("adds the moments together", () => {
    expect(totalWords([42, 87, 15])).toBe(144);
    expect(totalWords([])).toBe(0);
  });
});

describe("formatWords", () => {
  it("groups thousands the Swedish way", () => {
    expect(formatWords(7)).toBe("7 ord");
    expect(formatWords(1234)).toBe("1 234 ord");
  });
});
