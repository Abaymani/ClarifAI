import { describe, expect, test } from "vitest";

import { redactText, redactTranscript } from "./redact-transcript";
import type { Transcript } from "./transcript";

describe("redactText", () => {
  test("redacts direct identifiers without changing surrounding work", () => {
    const input = [
      "Jag heter Ada Lovelace och min mejl är ada@example.com.",
      "Ring 070-123 45 67. Personnummer: 20010101-1234.",
      "Terminal: student@school-laptop:~/project$ npm test",
      String.raw`Fil: C:\Users\ada\project\index.ts`,
      "Fil: /home/ada/project/index.ts",
    ].join("\n");

    expect(redactText(input)).toBe(
      [
        "Jag heter [REDACTED NAME] och min mejl är [REDACTED EMAIL].",
        "Ring [REDACTED PHONE]. Personnummer: [REDACTED PERSONNUMMER].",
        "Terminal: [REDACTED USER]@[REDACTED HOST]:~/project$ npm test",
        String.raw`Fil: C:\Users\[REDACTED USER]\project\index.ts`,
        "Fil: /home/[REDACTED USER]/project/index.ts",
      ].join("\n"),
    );
  });

  test("does not mistake ordinary numbers or package scopes for identifiers", () => {
    expect(redactText("Pin 13, 500 ms, npm @scope/pkg")).toBe(
      "Pin 13, 500 ms, npm @scope/pkg",
    );
  });
});

describe("redactTranscript", () => {
  test("redacts the title, displayed messages, and hidden drafts", () => {
    const transcript: Transcript = {
      source: {
        submittedLink: "https://gemini.google.com/share/abc123def456",
        shareUrl: "https://gemini.google.com/share/abc123def456",
        title: "Ada at ada@example.com",
        model: "Gemini",
        sharedAt: null,
      },
      retrievedAt: "2026-09-23T10:00:00.000Z",
      parserVersion: 1,
      messages: [
        {
          index: 1,
          role: "student",
          text: "My name is Ada Lovelace",
        },
        {
          index: 2,
          role: "gemini",
          text: "Hello Ada",
          otherDrafts: ["Email ada@example.com"],
        },
      ],
      warnings: [],
    };

    const result = redactTranscript(transcript);
    expect(result.source.title).toBe("Ada at [REDACTED EMAIL]");
    expect(result.messages[0].text).toBe("My name is [REDACTED NAME]");
    expect(result.messages[1].otherDrafts).toEqual(["Email [REDACTED EMAIL]"]);
    expect(transcript.messages[0].text).toBe("My name is Ada Lovelace");
  });
});
