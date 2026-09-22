export const PICTURE = "[PICTURE]";

export type TranscriptMessage = {
  // 1-based and stable: analysis evidence refers to messages by this number.
  index: number;
  role: "student" | "gemini";
  // Student prompts are plain text, Gemini answers Markdown. Images are [PICTURE].
  text: string;
  // Gemini's timestamp for the turn, which appears to be when the prompt was sent.
  sentAt?: string;
  // Drafts the student could switch between (e.g. after regenerating); `text` is the
  // one shown on the share page.
  otherDrafts?: string[];
};

export type Transcript = {
  source: {
    // What the student submitted, kept as the researchers' fallback.
    submittedLink: string;
    shareUrl: string;
    title: string | null;
    model: string | null;
    sharedAt: string | null;
  };
  retrievedAt: string;
  parserVersion: number;
  messages: TranscriptMessage[];
  // Content that could not be converted; never silently dropped.
  warnings: string[];
};

// Gemini refers to rich content with placeholder URLs such as
// http://googleusercontent.com/image_generation_content/0.
const GEMINI_PLACEHOLDER =
  /https?:\/\/googleusercontent\.com\/([a-z_]+)\/\d+/gi;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/g;

export function replaceMedia(
  text: string,
  onUnsupported: (kind: string) => void,
): string {
  return text
    .replace(MARKDOWN_IMAGE, PICTURE)
    .replace(GEMINI_PLACEHOLDER, (_match, kind: string) => {
      if (kind.toLowerCase().includes("image")) return PICTURE;
      onUnsupported(kind);
      return `[UNSUPPORTED CONTENT: ${kind}]`;
    });
}

// For human encoders; the JSON file is the canonical record.
export function transcriptToMarkdown(transcript: Transcript): string {
  const { source } = transcript;
  const lines = [
    `# ${source.title ?? "Gemini conversation"}`,
    "",
    `- Submitted link: ${source.submittedLink}`,
    `- Share page: ${source.shareUrl}`,
    `- Model: ${source.model ?? "unknown"}`,
    `- Shared: ${source.sharedAt ?? "unknown"}`,
    `- Retrieved: ${transcript.retrievedAt} (parser v${transcript.parserVersion})`,
    `- Messages: ${transcript.messages.length}`,
  ];
  if (transcript.warnings.length > 0) {
    lines.push("", "**Warnings**", "");
    lines.push(...transcript.warnings.map((warning) => `- ${warning}`));
  }

  for (const message of transcript.messages) {
    lines.push("", "---", "");
    if (message.role === "student") {
      const time = message.sentAt ? ` · ${message.sentAt}` : "";
      lines.push(`**[${message.index}] Student**${time}`, "");
      // Prompts are shown verbatim; a fence keeps pasted code and logs from being
      // read as Markdown.
      const fence = "`".repeat(
        Math.max(3, longestBacktickRun(message.text) + 1),
      );
      lines.push(`${fence}text`, message.text, fence);
    } else {
      lines.push(`**[${message.index}] Gemini**`, "", message.text);
      const drafts = message.otherDrafts?.length ?? 0;
      if (drafts > 0) {
        lines.push(
          "",
          `_Gemini produced ${drafts} other draft${drafts === 1 ? "" : "s"} for this answer (kept in the JSON file)._`,
        );
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function longestBacktickRun(text: string): number {
  return Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
}
