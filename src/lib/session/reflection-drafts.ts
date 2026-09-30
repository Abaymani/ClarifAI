import { MAX_REFLECTION_ANSWER_LENGTH, type AnalysisAgreement } from "./types";

export type ReflectionDraft = {
  answer: string;
  agreement: AnalysisAgreement | null;
};

export type ReflectionDrafts = Record<string, ReflectionDraft>;

type Items = readonly { id: string }[];

const KEY_PREFIX = "clarifai:reflection-draft:";

// Unsent answers are kept in the tab's sessionStorage: a reload brings them back,
// they never leave the computer, and they are gone when the tab closes (DL-049).
// Every set of questions gets its own key, so text written for other questions
// (another analysis, or R01 after a change of mind) is never filled in here.
export function reflectionDraftKey(
  sessionId: string,
  questionsCreatedAt: string,
): string {
  return `${KEY_PREFIX}${sessionId}:${questionsCreatedAt}`;
}

export function emptyDrafts(items: Items): ReflectionDrafts {
  return Object.fromEntries(
    items.map((item) => [item.id, { answer: "", agreement: null }]),
  );
}

// What the tab stored is input like any other: only the items on the page are
// filled, and only with values the form itself could have produced.
export function parseDrafts(
  raw: string | null,
  items: Items,
): ReflectionDrafts {
  const drafts = emptyDrafts(items);
  if (!raw) return drafts;

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return drafts;
  }
  if (!stored || typeof stored !== "object") return drafts;

  for (const item of items) {
    const draft = (stored as Record<string, unknown>)[item.id];
    if (!draft || typeof draft !== "object") continue;
    const { answer, agreement } = draft as Record<string, unknown>;
    drafts[item.id] = {
      answer:
        typeof answer === "string"
          ? answer.slice(0, MAX_REFLECTION_ANSWER_LENGTH)
          : "",
      agreement:
        agreement === "yes" || agreement === "partly" || agreement === "no"
          ? agreement
          : null,
    };
  }
  return drafts;
}

export function hasWrittenAnswer(drafts: ReflectionDrafts): boolean {
  return Object.values(drafts).some((draft) => draft.answer.trim() !== "");
}

// Storage can be switched off or full. The form works without the copy, so every
// failure here is ignored.
function tabStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStoredDrafts(key: string): string | null {
  try {
    return tabStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function storeDrafts(key: string, drafts: ReflectionDrafts): void {
  try {
    tabStorage()?.setItem(key, JSON.stringify(drafts));
  } catch {
    // Nothing to do: the answers are still in the form.
  }
}

export function clearStoredDrafts(): void {
  try {
    const storage = tabStorage();
    if (!storage) return;
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key?.startsWith(KEY_PREFIX)) storage.removeItem(key);
    }
  } catch {
    // Nothing to do: the copy disappears with the tab.
  }
}
