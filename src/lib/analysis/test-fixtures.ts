import type { Transcript } from "@/lib/scraping/transcript";

import type { RawCoding } from "./coding";
import {
  parseFramework,
  type Framework,
  type FrameworkFiles,
} from "./framework";

type GroupFixture = {
  code: string;
  kind: "reflect" | "reinforce" | "general" | "no_transcript" | "none";
  name: string;
  behaviourCodes: string[];
  intro: string | null;
  questions: string[];
  tip: string | null;
};

// A small framework of their own keeps the tests independent of `framework/`,
// which the researchers replace and edit.
export function testFrameworkFiles() {
  const header = { status: "TEST", version: "TEST-fixture" };
  const code = (id: string, name: string) => ({ code: id, name });
  const group = (
    id: string,
    kind: GroupFixture["kind"],
    behaviourCodes: string[],
  ): GroupFixture => {
    const base = { code: id, kind, name: `Group ${id}`, behaviourCodes };
    if (kind === "none")
      return { ...base, intro: null, questions: [], tip: null };
    // Texts tied to behaviour have bracketed parts to fit; the others are shown
    // as written.
    const fitted = kind === "reflect" || kind === "reinforce";
    return {
      ...base,
      intro: fitted
        ? `Here you [did this / did that] (${id}).`
        : `Intro ${id}.`,
      questions: fitted
        ? [`What made you [do it] (${id})?`, `Second question (${id})?`]
        : [`General question (${id})?`],
      tip: `I did it because … (${id})`,
    };
  };

  return {
    promptCoding: {
      ...header,
      icapCategories: [code("P", "Passive"), code("A", "Active")],
      codes: [
        code("NA3", "Code generation"),
        code("P1", "Decision delegation"),
        code("P2", "Factual question"),
        code("P3", "Troubleshooting delegation"),
        code("P8", "Step-by-step request"),
        code("A1", "Asks for another explanation"),
        code("A3", "Asks for a reason"),
        code("A4", "Restates"),
        code("C2", "Own attempt first"),
        code("C5", "Presents a hypothesis"),
      ],
    },
    sequenceCoding: {
      ...header,
      patterns: [
        code("S1", "Takes back the initiative"),
        code("S7", "Co-construction"),
      ],
    },
    grouping: {
      ...header,
      groups: [
        group("R1", "reflect", ["P1"]),
        group("R2", "reflect", ["P3"]),
        group("R3", "reflect", ["P2", "P8"]),
        group("R0", "general", []),
        group("R01", "no_transcript", []),
        group("RN", "none", ["NA3"]),
        group("F1", "reinforce", ["C2"]),
        group("F2", "reinforce", ["C5"]),
        group("F6", "reinforce", ["A1", "A3", "A4"]),
        group("F8", "reinforce", ["S1"]),
        group("F9", "reinforce", ["S7"]),
      ],
    },
    codingGuidelines: "Fixture coding guidelines.",
    reflectionGuidelines: "Fixture reflection guidelines." as string | null,
  } satisfies FrameworkFiles;
}

export function testFramework(): Framework {
  return parseFramework(testFrameworkFiles());
}

// Synthetic chat for tests; no real student data.
export function sampleTranscript(): Transcript {
  return {
    source: {
      submittedLink: "https://gemini.google.com/share/abc123def456",
      shareUrl: "https://gemini.google.com/share/abc123def456",
      title: "Avståndslarm",
      model: "Gemini",
      sharedAt: null,
    },
    retrievedAt: "2026-09-29T10:00:00.000Z",
    parserVersion: 1,
    messages: [
      {
        index: 1,
        role: "student",
        text: "Vi vill bygga ett avståndslarm. Jag tror att Trig ska till pin 9,\nstämmer det?",
      },
      { index: 2, role: "gemini", text: "Ja, och Echo kan sitta på pin 10." },
      { index: 3, role: "student", text: "Det fungerar inte, vad är fel?" },
      { index: 4, role: "gemini", text: "Kontrollera att GND är ansluten." },
      {
        index: 5,
        role: "student",
        text: "Varför behöver sensorn gemensam jord?",
      },
      {
        index: 6,
        role: "gemini",
        text: "Signalen behöver en gemensam referens.",
      },
      { index: 7, role: "student", text: "[PICTURE]" },
      { index: 8, role: "gemini", text: "Kopplingen på bilden ser rätt ut." },
    ],
    warnings: [],
  };
}

export function sampleCoding(): RawCoding {
  return {
    prompts: [
      {
        message: 1,
        // Two codes, the more important one first.
        codes: [
          {
            code: "C5",
            excerpt: "Jag tror att Trig ska till pin 9, stämmer det?",
            justification:
              "Eleven föreslår en egen koppling och ber om bekräftelse.",
          },
          {
            code: "C2",
            excerpt: "Vi vill bygga ett avståndslarm.",
            justification: "Eleven kommer med en egen projektidé.",
          },
        ],
        note: null,
      },
      {
        message: 3,
        codes: [
          {
            code: "P3",
            excerpt: "Det fungerar inte, vad är fel?",
            justification: "Eleven ber Gemini hitta felet utan egen gissning.",
          },
        ],
        note: null,
      },
      {
        message: 5,
        codes: [
          {
            code: "A3",
            excerpt: "Varför behöver sensorn gemensam jord?",
            justification: "Eleven frågar efter en motivering.",
          },
        ],
        note: null,
      },
      { message: 7, codes: [], note: "Meddelandet är bara en bild." },
    ],
    sequences: [
      {
        pattern: "S1",
        firstMessage: 3,
        lastMessage: 5,
        excerptMessage: 5,
        excerpt: "Varför behöver sensorn gemensam jord?",
        justification: "Passiv felsökning följs av en egen fråga om orsaken.",
      },
    ],
  };
}
