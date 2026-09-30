import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  hasWrittenAnswer,
  parseDrafts,
  readStoredDrafts,
  storeDrafts,
  type ReflectionDraft,
  type ReflectionDrafts,
} from "@/lib/session/reflection-drafts";

// Only this form writes the tab's copy, so there is nothing to listen for.
const neverChanges = () => () => {};
const nothingOnServer = () => null;

// Keeps unsent answers in the tab, so a reload brings them back, and has the
// browser ask before the student leaves with text that is not handed in (DL-049).
export function useReflectionDrafts(
  storageKey: string,
  items: readonly { id: string }[],
  submitting: boolean,
) {
  // Read as an external store: the server render and hydration then agree on an
  // empty form, and the stored text appears right after.
  const stored = useSyncExternalStore(
    neverChanges,
    () => readStoredDrafts(storageKey),
    nothingOnServer,
  );
  const restored = useMemo(() => parseDrafts(stored, items), [stored, items]);
  const [edited, setEdited] = useState<ReflectionDrafts | null>(null);
  const drafts = edited ?? restored;

  const updateDraft = (id: string, change: Partial<ReflectionDraft>) => {
    setEdited((current) => {
      const base = current ?? restored;
      return { ...base, [id]: { ...base[id], ...change } };
    });
  };

  // Only what the student changed is written, so opening the page never
  // replaces a stored copy with an empty form.
  useEffect(() => {
    if (edited) storeDrafts(storageKey, edited);
  }, [edited, storageKey]);

  // Handing in leaves the page too, but then nothing is lost.
  const unsent = hasWrittenAnswer(drafts) && !submitting;
  useEffect(() => {
    if (!unsent) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers only ask when this is set.
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [unsent]);

  return { drafts, updateDraft };
}
