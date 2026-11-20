// A word is text between whitespace that holds a letter or digit, close to a
// word processor's count, so a lone dash or emoji adds nothing (DL-085).
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export function countWords(text: string): number {
  return text.split(/\s+/u).filter((chunk) => HAS_LETTER_OR_DIGIT.test(chunk))
    .length;
}

export function totalWords(moments: readonly number[]): number {
  return moments.reduce((sum, words) => sum + words, 0);
}

// Students cannot submit an empty answer, so every moment counts (DL-086).
export function averageWords(moments: readonly number[]): number | null {
  return moments.length === 0 ? null : totalWords(moments) / moments.length;
}

const WORDS = new Intl.NumberFormat("sv-SE");
const AVERAGE = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatWords(words: number): string {
  return `${WORDS.format(words)} ord`;
}

export function formatAverageWords(average: number): string {
  return `${AVERAGE.format(average)} ord`;
}
