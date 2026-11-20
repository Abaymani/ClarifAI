import { describe, expect, test } from "vitest";

import { listAdminOverview } from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

function reflectionQuestions(ids: string[]) {
  return {
    frameworkVersion: "test",
    frameworkStatus: "ACTIVE",
    analyser: "fake",
    model: null,
    reasoningEffort: null,
    createdAt: "2026-11-20T00:00:00.000Z",
    durationMs: 1,
    usage: null,
    outcome: "observations",
    items: ids.map((id) => ({
      id,
      group: "R0",
      groupKind: "general",
      basedOn: null,
      excerpt: null,
      intro: "Reflektera över arbetet.",
      questions: ["Vad tar du med dig?"],
      tip: null,
      template: {
        intro: "Reflektera över arbetet.",
        questions: ["Vad tar du med dig?"],
      },
    })),
  };
}

async function seedSession(
  id: string,
  {
    items = ["q1", "q2", "q3"],
    answers,
  }: { items?: string[]; answers?: Record<string, string> },
) {
  const [participantCode, lessonText] = id.split("_");
  await getDb()
    .collection("sessions")
    .doc(id)
    .set({
      participantCode,
      lesson: Number(lessonText),
      status: answers ? "completed" : "awaiting_reflection",
      transcriptSubmission: "no_gemini",
      reflectionQuestions: reflectionQuestions(items),
      ...(answers
        ? {
            reflectionResponses: {
              submittedAt: new Date(),
              items: Object.entries(answers).map(([itemId, answer]) => ({
                itemId,
                answer,
                agreement: null,
              })),
            },
          }
        : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

describe("reflection word counts", () => {
  test("gives the overview each moment's words in question order, for lessons 2 and 3 only", async () => {
    await seedSession("941_2", {
      // Stored out of order and without q2, which the student left unanswered.
      answers: {
        q3: "Nästa gång – planerar jag 🙂 bättre.",
        q1: "Det gick bra med AI-verktyget.",
      },
    });
    await seedSession("941_3", {});
    await seedSession("941_4", { answers: { q1: "Fyra ord här ändå." } });
    await seedSession("942_2", { items: [], answers: {} });

    const overview = await listAdminOverview();
    const first = overview.find((entry) => entry.participantCode === "941");
    const second = overview.find((entry) => entry.participantCode === "942");

    expect(first?.sessions[2]?.reflectionWords).toEqual({
      state: "submitted",
      moments: [5, 0, 5],
    });
    expect(first?.sessions[3]?.reflectionWords).toEqual({
      state: "not_submitted",
    });
    expect(first?.sessions[4]?.reflectionWords).toBeUndefined();
    expect(second?.sessions[2]?.reflectionWords).toEqual({
      state: "unavailable",
    });
  });
});
