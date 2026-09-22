// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  replaceMedia,
  transcriptToMarkdown,
  type Transcript,
} from "./transcript";

const transcript: Transcript = {
  source: {
    submittedLink: "https://share.gemini.google/AbCdEf123456",
    shareUrl: "https://gemini.google.com/share/abc123def456",
    title: "Blinking an LED",
    model: "3.6 Flash",
    sharedAt: "2026-09-22T11:00:00.000Z",
  },
  retrievedAt: "2026-09-22T12:00:00.000Z",
  parserVersion: 1,
  messages: [
    {
      index: 1,
      role: "student",
      text: "# not a heading\nvoid loop() {}",
      sentAt: "2026-09-09T08:19:18.000Z",
    },
    {
      index: 2,
      role: "gemini",
      text: "Use `delay(1000)`.",
      otherDrafts: ["Another answer"],
    },
  ],
  warnings: ["Message 2: unsupported content (youtube_content)."],
};

describe("replaceMedia", () => {
  test("replaces Markdown images and Gemini image placeholders", () => {
    const reported: string[] = [];
    const text = replaceMedia(
      "![led](https://x.test/a.png) http://googleusercontent.com/image_generation_content/3",
      (kind) => reported.push(kind),
    );
    expect(text).toBe("[PICTURE] [PICTURE]");
    expect(reported).toEqual([]);
  });

  test("marks other Gemini placeholders and reports them", () => {
    const reported: string[] = [];
    const text = replaceMedia(
      "see http://googleusercontent.com/immersive_entry_chip/0",
      (kind) => reported.push(kind),
    );
    expect(text).toBe("see [UNSUPPORTED CONTENT: immersive_entry_chip]");
    expect(reported).toEqual(["immersive_entry_chip"]);
  });
});

describe("transcriptToMarkdown", () => {
  const markdown = transcriptToMarkdown(transcript);

  test("starts with the title and source details", () => {
    expect(markdown).toMatch(/^# Blinking an LED\n/);
    expect(markdown).toContain(
      "- Share page: https://gemini.google.com/share/abc123def456",
    );
    expect(markdown).toContain("- Messages: 2");
  });

  test("numbers messages and keeps student prompts verbatim in a fence", () => {
    expect(markdown).toContain(
      "**[1] Student** · 2026-09-09T08:19:18.000Z\n\n```text\n# not a heading\nvoid loop() {}\n```",
    );
    expect(markdown).toContain("**[2] Gemini**\n\nUse `delay(1000)`.");
  });

  test("uses a longer fence when a prompt contains backticks", () => {
    const withFence = transcriptToMarkdown({
      ...transcript,
      messages: [{ index: 1, role: "student", text: "```cpp\nint x;\n```" }],
    });
    expect(withFence).toContain("````text\n```cpp\nint x;\n```\n````");
  });

  test("lists warnings and mentions other drafts", () => {
    expect(markdown).toContain(
      "**Warnings**\n\n- Message 2: unsupported content (youtube_content).",
    );
    expect(markdown).toContain(
      "_Gemini produced 1 other draft for this answer",
    );
  });
});
