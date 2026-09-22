// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

import {
  buildTranscript,
  parseBatchExecuteResponse,
  scrapeGeminiShare,
} from "./gemini-share";
import { ScrapeError } from "./scrape-error";
import {
  batchExecuteResponse,
  NOT_FOUND_RESPONSE,
  sharePayload,
  type FixtureTurn,
} from "./test-fixtures";

const context = {
  submittedLink: "https://share.gemini.google/AbCdEf123456",
  shareId: "abc123def456",
  retrievedAt: "2026-09-22T12:00:00.000Z",
};

const twoTurns: FixtureTurn[] = [
  {
    prompt: "How do I blink an LED?",
    sentAt: 1788941958,
    drafts: ["Use `digitalWrite`."],
  },
  {
    prompt: "Which pin?",
    sentAt: 1788941989,
    drafts: ["Pin 13 has a built-in LED."],
  },
];

async function errorCode(run: () => unknown): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return error instanceof ScrapeError ? error.code : "not a ScrapeError";
  }
  return undefined;
}

describe("buildTranscript", () => {
  test("alternates student prompts and Gemini answers, numbered from 1", () => {
    const transcript = buildTranscript(sharePayload(twoTurns), context);

    expect(
      transcript.messages.map(({ index, role, text }) => ({
        index,
        role,
        text,
      })),
    ).toEqual([
      { index: 1, role: "student", text: "How do I blink an LED?" },
      { index: 2, role: "gemini", text: "Use `digitalWrite`." },
      { index: 3, role: "student", text: "Which pin?" },
      { index: 4, role: "gemini", text: "Pin 13 has a built-in LED." },
    ]);
    expect(transcript.messages[0].sentAt).toBe("2026-09-09T08:19:18.500Z");
    expect(transcript.warnings).toEqual([]);
  });

  test("keeps chronological order even if turns arrive newest first", () => {
    const transcript = buildTranscript(
      sharePayload([...twoTurns].reverse()),
      context,
    );
    expect(transcript.messages[0].text).toBe("How do I blink an LED?");
  });

  test("uses the draft shown on the share page and keeps the others", () => {
    const transcript = buildTranscript(
      sharePayload([
        {
          prompt: "Explain PWM",
          sentAt: 1788941958,
          drafts: ["First draft", "Second draft", "Third draft"],
          shownDraft: 1,
        },
      ]),
      context,
    );
    expect(transcript.messages[1].text).toBe("Second draft");
    expect(transcript.messages[1].otherDrafts).toEqual([
      "First draft",
      "Third draft",
    ]);
  });

  test("replaces images with [PICTURE]", () => {
    const transcript = buildTranscript(
      sharePayload([
        {
          prompt: "Draw a circuit",
          sentAt: 1788941958,
          drafts: [
            "Here it is:\n\nhttp://googleusercontent.com/image_generation_content/0\n\nand ![wiring](https://example.com/w.png)",
          ],
        },
      ]),
      context,
    );
    expect(transcript.messages[1].text).toBe(
      "Here it is:\n\n[PICTURE]\n\nand [PICTURE]",
    );
    expect(transcript.warnings).toEqual([]);
  });

  test("marks and reports content it cannot convert instead of dropping it", () => {
    const transcript = buildTranscript(
      sharePayload([
        {
          prompt: "What does this show?",
          sentAt: 1788941958,
          drafts: ["Watch http://googleusercontent.com/youtube_content/0"],
          promptFields: { 10: [["attachment"]] },
        },
      ]),
      context,
    );
    expect(transcript.messages[0].text).toBe(
      "What does this show?\n[UNSUPPORTED CONTENT]",
    );
    expect(transcript.messages[1].text).toBe(
      "Watch [UNSUPPORTED CONTENT: youtube_content]",
    );
    expect(transcript.warnings).toHaveLength(2);
    expect(transcript.warnings.join(" ")).not.toContain("What does this show");
  });

  test("reads the title, model and share time", () => {
    const transcript = buildTranscript(sharePayload(twoTurns), context);
    expect(transcript.source).toEqual({
      submittedLink: context.submittedLink,
      shareUrl: "https://gemini.google.com/share/abc123def456",
      title: "Blinking an LED",
      model: "3.6 Flash",
      sharedAt: "2026-09-21T14:13:20.000Z",
    });
    expect(transcript.retrievedAt).toBe(context.retrievedAt);
  });

  test("rejects a chat without messages", async () => {
    expect(
      await errorCode(() => buildTranscript(sharePayload([]), context)),
    ).toBe("EMPTY_TRANSCRIPT");
  });

  test("fails loudly when Gemini changes the format", async () => {
    const payload = sharePayload(twoTurns) as unknown[][][][][];
    payload[0][1][1][2] = [42]; // prompt text is no longer where we expect it
    expect(await errorCode(() => buildTranscript(payload, context))).toBe(
      "UNEXPECTED_FORMAT",
    );
  });

  test("rejects data for a different chat", async () => {
    const payload = sharePayload(twoTurns, { shareId: "someoneelse1" });
    expect(await errorCode(() => buildTranscript(payload, context))).toBe(
      "UNEXPECTED_FORMAT",
    );
  });
});

describe("parseBatchExecuteResponse", () => {
  test("extracts the chat payload", () => {
    const payload = sharePayload(twoTurns);
    expect(
      parseBatchExecuteResponse(batchExecuteResponse(payload), "ujx1Bf"),
    ).toEqual(payload);
  });

  test("reports an unknown or deleted share as NOT_FOUND", async () => {
    expect(
      await errorCode(() =>
        parseBatchExecuteResponse(NOT_FOUND_RESPONSE, "ujx1Bf"),
      ),
    ).toBe("NOT_FOUND");
  });

  test("reports a private share as NOT_ACCESSIBLE", async () => {
    const response = NOT_FOUND_RESPONSE.replace("[5]", "[7]");
    expect(
      await errorCode(() => parseBatchExecuteResponse(response, "ujx1Bf")),
    ).toBe("NOT_ACCESSIBLE");
  });

  test("rejects responses without chat data", async () => {
    expect(
      await errorCode(() =>
        parseBatchExecuteResponse(
          "<!doctype html><title>Sorry</title>",
          "ujx1Bf",
        ),
      ),
    ).toBe("UNEXPECTED_FORMAT");
  });
});

describe("scrapeGeminiShare", () => {
  test("resolves a short link and fetches the chat in one request", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.startsWith("https://share.gemini.google/")) {
        return new Response(null, {
          status: 301,
          headers: {
            location: "https://gemini.google.com/share/abc123def456?skid=x",
          },
        });
      }
      if (
        url.startsWith(
          "https://gemini.google.com/_/BardChatUi/data/batchexecute",
        )
      ) {
        return new Response(batchExecuteResponse(sharePayload(twoTurns)));
      }
      throw new Error(`Unexpected request to ${url}`);
    });

    const transcript = await scrapeGeminiShare(
      "  https://share.gemini.google/AbCdEf123456 ",
      { fetch: fetchSpy, now: () => new Date(context.retrievedAt) },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [, init] = fetchSpy.mock.calls[1];
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("abc123def456");
    expect(transcript.source.submittedLink).toBe(
      "https://share.gemini.google/AbCdEf123456",
    );
    expect(transcript.messages).toHaveLength(4);
  });

  test("turns HTTP errors into FETCH_FAILED", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response("", { status: 503 }),
    );
    expect(
      await errorCode(() =>
        scrapeGeminiShare("https://gemini.google.com/share/abc123def456", {
          fetch: fetchSpy,
        }),
      ),
    ).toBe("FETCH_FAILED");
  });
});
