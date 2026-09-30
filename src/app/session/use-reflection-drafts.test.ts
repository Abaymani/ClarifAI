import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  parseDrafts,
  readStoredDrafts,
  reflectionDraftKey,
  storeDrafts,
} from "@/lib/session/reflection-drafts";

import { useReflectionDrafts } from "./use-reflection-drafts";

const items = [{ id: "q1" }, { id: "q2" }];
const key = reflectionDraftKey("12_3", "2026-09-30T10:00:00.000Z");
const empty = { answer: "", agreement: null };

// True when the browser would ask the student before leaving the page.
function asksBeforeLeaving(): boolean {
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  return leaving.defaultPrevented;
}

function form(submitting = false) {
  return renderHook(
    (props: { submitting: boolean }) =>
      useReflectionDrafts(key, items, props.submitting),
    { initialProps: { submitting } },
  );
}

afterEach(() => {
  sessionStorage.clear();
});

describe("useReflectionDrafts", () => {
  it("starts with an empty form that the student can leave freely", () => {
    const { result } = form();

    expect(result.current.drafts).toEqual({ q1: empty, q2: empty });
    expect(asksBeforeLeaving()).toBe(false);
  });

  it("fills in what the tab stored before a reload", () => {
    storeDrafts(key, {
      q1: { answer: "Jag hann inte klart.", agreement: "partly" },
      q2: empty,
    });

    const { result } = form();

    expect(result.current.drafts.q1).toEqual({
      answer: "Jag hann inte klart.",
      agreement: "partly",
    });
  });

  it("stores every change, together with what was already written", () => {
    const { result } = form();

    act(() => result.current.updateDraft("q1", { agreement: "no" }));
    act(() =>
      result.current.updateDraft("q1", { answer: "Det stämmer inte." }),
    );
    act(() => result.current.updateDraft("q2", { answer: "Ja." }));

    const expected = {
      q1: { answer: "Det stämmer inte.", agreement: "no" },
      q2: { answer: "Ja.", agreement: null },
    };
    expect(result.current.drafts).toEqual(expected);
    expect(parseDrafts(readStoredDrafts(key), items)).toEqual(expected);
  });

  it("keeps both changes when two arrive before the form is drawn again", () => {
    storeDrafts(key, { q1: { answer: "", agreement: "yes" }, q2: empty });
    const { result } = form();

    act(() => {
      result.current.updateDraft("q1", { answer: "Ett." });
      result.current.updateDraft("q2", { answer: "Två." });
    });

    const expected = {
      q1: { answer: "Ett.", agreement: "yes" },
      q2: { answer: "Två.", agreement: null },
    };
    expect(result.current.drafts).toEqual(expected);
    expect(parseDrafts(readStoredDrafts(key), items)).toEqual(expected);
  });

  it("leaves a stored copy alone until the student changes something", () => {
    const stored = { q1: { answer: "Sparat.", agreement: null }, q2: empty };
    storeDrafts(key, stored);

    form();

    expect(parseDrafts(readStoredDrafts(key), items)).toEqual(stored);
  });

  it("asks before leaving once an answer is written, but not while handing in", () => {
    const { result, rerender, unmount } = form();

    act(() => result.current.updateDraft("q1", { agreement: "yes" }));
    expect(asksBeforeLeaving()).toBe(false);

    act(() => result.current.updateDraft("q1", { answer: "Ett svar." }));
    expect(asksBeforeLeaving()).toBe(true);

    rerender({ submitting: true });
    expect(asksBeforeLeaving()).toBe(false);

    rerender({ submitting: false });
    expect(asksBeforeLeaving()).toBe(true);

    unmount();
    expect(asksBeforeLeaving()).toBe(false);
  });
});
