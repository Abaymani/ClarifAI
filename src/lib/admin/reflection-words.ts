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

const WORDS = new Intl.NumberFormat("sv-SE");

export function formatWords(words: number): string {
  return `${WORDS.format(words)} ord`;
}
