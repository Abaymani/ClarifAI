// Local stand-in for S1 until Firebase exists: scrapes a Gemini share link and saves the
// transcript in the git-ignored private-data/ folder.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { scrapeGeminiShare } from "@/lib/scraping/gemini-share";
import { ScrapeError } from "@/lib/scraping/scrape-error";
import { transcriptToMarkdown } from "@/lib/scraping/transcript";

const OUTPUT_DIR = path.join("private-data", "transcripts");

async function main(link: string | undefined): Promise<number> {
  if (!link) {
    console.error("Usage: pnpm scrape <Gemini share link>");
    return 2;
  }

  const started = performance.now();
  try {
    const transcript = await scrapeGeminiShare(link);
    const shareId = new URL(transcript.source.shareUrl).pathname
      .split("/")
      .at(-1);
    const base = path.join(OUTPUT_DIR, shareId ?? "unknown");
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(`${base}.json`, `${JSON.stringify(transcript, null, 2)}\n`);
    await writeFile(`${base}.md`, transcriptToMarkdown(transcript));

    const drafts = transcript.messages.reduce(
      (sum, message) => sum + (message.otherDrafts?.length ?? 0),
      0,
    );
    console.log(
      [
        `Scraped in ${Math.round(performance.now() - started)} ms`,
        `  title:    ${transcript.source.title ?? "(none)"}`,
        `  model:    ${transcript.source.model ?? "(unknown)"}`,
        `  messages: ${transcript.messages.length} (+${drafts} other drafts)`,
        `  warnings: ${transcript.warnings.length}`,
        ...transcript.warnings.map((warning) => `    - ${warning}`),
        `  saved:    ${base}.json, ${base}.md`,
      ].join("\n"),
    );
    return 0;
  } catch (error) {
    if (error instanceof ScrapeError) {
      console.error(`${error.code}: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

main(process.argv[2]).then((code) => {
  process.exitCode = code;
});
