import { describe, expect, it } from "vitest";

import { highlightExcerpt, surroundingMessages } from "./context";
import { sampleTranscript } from "./test-fixtures";

describe("surroundingMessages", () => {
  const { messages } = sampleTranscript();

  it("returns the quoted message with its neighbours", () => {
    const around = surroundingMessages(messages, 3);
    expect(around?.before?.index).toBe(2);
    expect(around?.focus.index).toBe(3);
    expect(around?.after?.index).toBe(4);
  });

  it("has no neighbour before the first or after the last message", () => {
    expect(surroundingMessages(messages, 1)?.before).toBeNull();
    expect(surroundingMessages(messages, 8)?.after).toBeNull();
    expect(surroundingMessages(messages, 99)).toBeNull();
  });
});

describe("highlightExcerpt", () => {
  it("marks the excerpt in a short message and keeps the rest", () => {
    expect(
      highlightExcerpt("Det fungerar inte, vad är fel?", "vad är fel?"),
    ).toEqual({
      before: "Det fungerar inte, ",
      match: "vad är fel?",
      after: "",
      clippedStart: false,
      clippedEnd: false,
    });
  });

  it("doesn't mark an excerpt that is the whole message", () => {
    expect(highlightExcerpt(" Vad är fel?\n", "Vad är fel?")).toMatchObject({
      before: " Vad är fel?\n",
      match: null,
    });
  });

  it("finds excerpts whose line breaks differ from the message", () => {
    const text = "Jag tror att Trig ska till pin 9,\nstämmer det?";
    expect(highlightExcerpt(text, "pin 9, stämmer det?").match).toBe(
      "pin 9,\nstämmer det?",
    );
  });

  it("cuts long messages around the excerpt, at word boundaries", () => {
    const text = `${"början ".repeat(60)}sensorn visar noll${" slutet".repeat(60)}`;
    const result = highlightExcerpt(text, "sensorn visar noll");

    expect(result.match).toBe("sensorn visar noll");
    expect(result.clippedStart).toBe(true);
    expect(result.clippedEnd).toBe(true);
    expect(result.before.length).toBeLessThanOrEqual(150);
    expect(result.before.startsWith("början")).toBe(true);
    expect(result.after.trimEnd().endsWith("slutet")).toBe(true);
  });

  it("shows the message without a highlight if the excerpt can't be found", () => {
    expect(highlightExcerpt("Hej hej", "något annat")).toMatchObject({
      before: "Hej hej",
      match: null,
      clippedEnd: false,
    });
  });

  it("treats regular-expression characters in excerpts as plain text", () => {
    expect(highlightExcerpt("Vad betyder (x+1)*2?", "(x+1)*2?").match).toBe(
      "(x+1)*2?",
    );
  });
});
