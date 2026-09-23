import type { Transcript, TranscriptMessage } from "./transcript";

const REDACTED = {
  email: "[REDACTED EMAIL]",
  name: "[REDACTED NAME]",
  personnummer: "[REDACTED PERSONNUMMER]",
  phone: "[REDACTED PHONE]",
  user: "[REDACTED USER]",
  host: "[REDACTED HOST]",
} as const;

const EMAIL = /\b[A-Z\d._%+-]+@[A-Z\d.-]+\.[A-Z]{2,}\b/gi;
const PERSONNUMMER = /\b(?:19|20)?\d{6}[-+]\d{4}\b/g;
const SWEDISH_PHONE = /(?<!\w)(?:\+46|0046|0)(?:[\s-]?\d){7,10}(?!\w)/g;
const SHELL_USER_HOST = /\b[\p{L}\d._-]+@[\p{L}\d.-]+(?=[:#$>\s])/gu;
const WINDOWS_USER_PATH = /\b([A-Z]:\\Users\\)([^\\\s]+)(?=\\|\b)/gi;
const UNIX_USER_PATH = /\/(home|Users)\/([^/\s]+)(?=\/|\b)/g;
const INTRODUCED_NAME =
  /\b(jag heter|mitt namn är|kalla mig|my name is|call me)\s+([\p{L}][\p{L}'’-]*(?:[ \t]+[\p{L}][\p{L}'’-]*)?)/giu;

export function redactText(text: string): string {
  return text
    .replace(EMAIL, REDACTED.email)
    .replace(PERSONNUMMER, REDACTED.personnummer)
    .replace(SWEDISH_PHONE, REDACTED.phone)
    .replace(SHELL_USER_HOST, `${REDACTED.user}@${REDACTED.host}`)
    .replace(WINDOWS_USER_PATH, `$1${REDACTED.user}`)
    .replace(
      UNIX_USER_PATH,
      (_match, root: string) => `/${root}/${REDACTED.user}`,
    )
    .replace(
      INTRODUCED_NAME,
      (_match, introduction: string) => `${introduction} ${REDACTED.name}`,
    );
}

export function redactTranscript(transcript: Transcript): Transcript {
  return {
    ...transcript,
    source: {
      ...transcript.source,
      title: transcript.source.title
        ? redactText(transcript.source.title)
        : null,
    },
    messages: transcript.messages.map(redactMessage),
  };
}

function redactMessage(message: TranscriptMessage): TranscriptMessage {
  return {
    ...message,
    text: redactText(message.text),
    ...(message.otherDrafts
      ? { otherDrafts: message.otherDrafts.map(redactText) }
      : {}),
  };
}
