import { ScrapeError } from "./scrape-error";

const CANONICAL_HOST = "gemini.google.com";
const SHARE_ID = /^[A-Za-z\d_-]{6,64}$/;
const MAX_REDIRECTS = 3;

export type ShareLink =
  { kind: "canonical"; shareId: string } | { kind: "short"; url: URL };

// The server fetches whatever students submit, so only the link formats Gemini hands
// out are accepted; anything else could point our requests at other hosts.
export function parseShareLink(input: string): ShareLink {
  const trimmed = input.trim();
  // Students often copy links without the scheme.
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw invalidLink();
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw invalidLink();
  }

  const shareId = canonicalShareId(url);
  if (shareId) return { kind: "canonical", shareId };

  const isShortLink =
    (url.hostname === "share.gemini.google" &&
      /^\/[A-Za-z\d_-]+\/?$/.test(url.pathname)) ||
    (url.hostname === "g.co" &&
      /^\/gemini\/share\/[A-Za-z\d_-]+\/?$/.test(url.pathname));
  if (isShortLink) return { kind: "short", url };

  throw invalidLink();
}

// Short links only redirect to the share page. Redirects are followed by hand so every
// hop is checked against the allowed formats instead of trusting the target.
export async function resolveShareId(
  link: ShareLink,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let current = link;
  let redirects = 0;
  while (current.kind === "short") {
    if (redirects++ === MAX_REDIRECTS) {
      throw new ScrapeError(
        "FETCH_FAILED",
        "The short link redirected too many times",
      );
    }

    const target = `https://${current.url.hostname}${current.url.pathname}`;
    let response: Response;
    try {
      response = await fetchImpl(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new ScrapeError(
        "FETCH_FAILED",
        "Could not reach the short-link service",
        { cause: error },
      );
    }
    await response.body?.cancel();

    if (response.status === 404) {
      throw new ScrapeError("NOT_FOUND", "The short link does not exist");
    }
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      throw new ScrapeError(
        "FETCH_FAILED",
        `The short link answered with HTTP ${response.status}`,
      );
    }

    try {
      current = parseShareLink(new URL(location, target).href);
    } catch {
      throw new ScrapeError(
        "INVALID_LINK",
        "The short link does not lead to a Gemini share page",
      );
    }
  }
  return current.shareId;
}

export function shareUrl(shareId: string): string {
  return `https://${CANONICAL_HOST}/share/${shareId}`;
}

function canonicalShareId(url: URL): string | null {
  if (url.hostname !== CANONICAL_HOST) return null;
  const id = /^\/share\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  return id && SHARE_ID.test(id) ? id : null;
}

function invalidLink(): ScrapeError {
  return new ScrapeError("INVALID_LINK", "Not a Gemini share link");
}
