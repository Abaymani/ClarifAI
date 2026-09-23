// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

import {
  parseShareLink,
  resolveShareId,
  shareLinkForStorage,
} from "./gemini-link";
import { ScrapeError } from "./scrape-error";

async function errorCode(run: () => unknown): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return error instanceof ScrapeError ? error.code : "not a ScrapeError";
  }
  return undefined;
}

function redirectTo(location: string): Response {
  return new Response(null, { status: 301, headers: { location } });
}

describe("parseShareLink", () => {
  test.each([
    "https://gemini.google.com/share/0a1b2c3d4e5f",
    "https://gemini.google.com/share/0a1b2c3d4e5f?skid=1234abcd",
    "gemini.google.com/share/0a1b2c3d4e5f/",
    "  http://gemini.google.com/share/0a1b2c3d4e5f  ",
  ])("accepts the share page link %j", (input) => {
    expect(parseShareLink(input)).toEqual({
      kind: "canonical",
      shareId: "0a1b2c3d4e5f",
    });
  });

  test.each([
    "https://share.gemini.google/AbCdEf123456",
    "share.gemini.google/AbCdEf123456",
    "https://g.co/gemini/share/0a1b2c3d4e5f",
  ])("recognises the short link %j", (input) => {
    expect(parseShareLink(input).kind).toBe("short");
  });

  test.each([
    "",
    "not a link",
    "https://example.com/share/0a1b2c3d4e5f",
    "https://gemini.google.com.evil.example/share/0a1b2c3d4e5f",
    "https://evilgemini.google.com/share/0a1b2c3d4e5f",
    "https://gemini.google.com/app/0a1b2c3d4e5f",
    "https://gemini.google.com/share/../../etc/passwd",
    "https://gemini.google.com:8443/share/0a1b2c3d4e5f",
    "https://user:secret@gemini.google.com/share/0a1b2c3d4e5f",
    "ftp://gemini.google.com/share/0a1b2c3d4e5f",
    "javascript:alert(1)",
    "https://g.co/maps/0a1b2c3d4e5f",
    "https://share.gemini.google/a/b",
  ])("rejects %j", async (input) => {
    expect(await errorCode(() => parseShareLink(input))).toBe("INVALID_LINK");
  });
});

describe("shareLinkForStorage", () => {
  test("keeps only the part of a supported URL needed for retrieval", () => {
    const parsed = parseShareLink(
      "https://gemini.google.com/share/abc123def456?name=Ada#private",
    );
    expect(shareLinkForStorage(parsed)).toBe(
      "https://gemini.google.com/share/abc123def456",
    );
  });
});

describe("resolveShareId", () => {
  test("needs no request for share page links", async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    const link = parseShareLink("https://gemini.google.com/share/0a1b2c3d4e5f");
    expect(await resolveShareId(link, fetchSpy)).toBe("0a1b2c3d4e5f");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("follows a short link to the share page without auto-following redirects", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () =>
      redirectTo("https://gemini.google.com/share/0a1b2c3d4e5f?skid=x"),
    );
    const link = parseShareLink(
      "https://share.gemini.google/AbCdEf123456?utm=1",
    );

    expect(await resolveShareId(link, fetchSpy)).toBe("0a1b2c3d4e5f");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://share.gemini.google/AbCdEf123456");
    expect(init?.redirect).toBe("manual");
  });

  test("refuses redirects to other hosts", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () =>
      redirectTo("http://169.254.169.254/share/0a1b2c3d4e5f"),
    );
    const link = parseShareLink("https://share.gemini.google/AbCdEf123456");
    expect(await errorCode(() => resolveShareId(link, fetchSpy))).toBe(
      "INVALID_LINK",
    );
  });

  test("reports unknown short links as NOT_FOUND", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response("", { status: 404 }),
    );
    const link = parseShareLink("https://share.gemini.google/zzzzzzzzzzzz");
    expect(await errorCode(() => resolveShareId(link, fetchSpy))).toBe(
      "NOT_FOUND",
    );
  });

  test("gives up on redirect loops", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () =>
      redirectTo("https://share.gemini.google/loop"),
    );
    const link = parseShareLink("https://share.gemini.google/loop");
    expect(await errorCode(() => resolveShareId(link, fetchSpy))).toBe(
      "FETCH_FAILED",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  test("reports network errors as FETCH_FAILED", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    const link = parseShareLink("https://g.co/gemini/share/0a1b2c3d4e5f");
    expect(await errorCode(() => resolveShareId(link, fetchSpy))).toBe(
      "FETCH_FAILED",
    );
  });
});
