import { describe, expect, test } from "vitest";

import {
  listAdminOverview,
  listReflectionCoding,
  saveReflectionCoding,
} from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

const reflectionQuestions = {
  frameworkVersion: "test",
  frameworkStatus: "ACTIVE",
  analyser: "fake",
  model: null,
  reasoningEffort: null,
  createdAt: "2026-11-19T00:00:00.000Z",
  durationMs: 1,
  usage: null,
  outcome: "observations",
  items: ["q1", "q2"].map((id) => ({
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

async function seedSession(
  id: string,
  { submitted = true }: { submitted?: boolean } = {},
) {
  const [participantCode, lessonText] = id.split("_");
  const lesson = Number(lessonText);
  await getDb()
    .collection("sessions")
    .doc(id)
    .set({
      participantCode,
      lesson,
      status: submitted ? "completed" : "awaiting_reflection",
      transcriptSubmission: "no_gemini",
      reflectionQuestions,
      ...(submitted
        ? {
            reflectionResponses: {
              submittedAt: new Date(),
              items: [
                { itemId: "q1", answer: "Det gick bra.", agreement: null },
                { itemId: "q2", answer: "Nästa gång…", agreement: null },
              ],
            },
          }
        : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

describe("reflection coding", () => {
  test("writes only the researcher's own record and leaves the session unchanged", async () => {
    await seedSession("971_2");
    const db = getDb();
    const before = (await db.doc("sessions/971_2").get()).data();
    await db
      .doc("sessions/971_2/researcherReflectionComments/R1/entries/q1")
      .set({ researcherId: "R1", itemId: "q1", comment: "Behåll" });

    await saveReflectionCoding({
      sessionId: "971_2",
      researcherId: "R1",
      itemId: "q1",
      criteria: ["S3-ACTION-PLAN", "S1-WENT-WELL", "S1-WENT-WELL"],
      coded: false,
    });
    await saveReflectionCoding({
      sessionId: "971_2",
      researcherId: "R2",
      itemId: "q1",
      criteria: ["S2-SIMILAR"],
      coded: true,
    });

    const coding = await listReflectionCoding("971_2");
    expect(coding.R1).toEqual([
      expect.objectContaining({
        itemId: "q1",
        criteria: ["S1-WENT-WELL", "S3-ACTION-PLAN"],
        coded: false,
        frameworkVersion: "2026-11-19.1",
      }),
    ]);
    expect(coding.R2).toEqual([
      expect.objectContaining({ criteria: ["S2-SIMILAR"], coded: true }),
    ]);
    expect((await db.doc("sessions/971_2").get()).data()).toEqual(before);
    expect(
      (
        await db
          .doc("sessions/971_2/researcherReflectionComments/R1/entries/q1")
          .get()
      ).data()?.comment,
    ).toBe("Behåll");

    // An empty, unmarked record is removed rather than kept as 0.
    await saveReflectionCoding({
      sessionId: "971_2",
      researcherId: "R1",
      itemId: "q1",
      criteria: [],
      coded: false,
    });
    expect((await listReflectionCoding("971_2")).R1).toEqual([]);
  });

  test("refuses moments that cannot be coded", async () => {
    await seedSession("972_2", { submitted: false });
    await seedSession("972_4");
    await seedSession("973_3");
    const save = (sessionId: string, itemId: string, criteria: string[]) =>
      saveReflectionCoding({
        sessionId,
        researcherId: "R1",
        itemId,
        criteria,
        coded: true,
      });

    await expect(save("972_2", "q1", [])).rejects.toMatchObject({
      code: "REFLECTION_NOT_SUBMITTED",
    });
    await expect(save("972_4", "q1", [])).rejects.toMatchObject({
      code: "INVALID_REFLECTION_ITEM",
    });
    await expect(save("973_3", "q9", [])).rejects.toMatchObject({
      code: "INVALID_REFLECTION_ITEM",
    });
    await expect(
      save("973_3", "q1", ["NOT-A-CRITERION"]),
    ).rejects.toMatchObject({ code: "INVALID_CODE" });
    expect(await listReflectionCoding("972_2")).toEqual({ R1: [], R2: [] });
  });

  test("gives the overview each marked moment's totals without counting it as prompt coding", async () => {
    await seedSession("974_2");
    await seedSession("974_3", { submitted: false });
    await saveReflectionCoding({
      sessionId: "974_2",
      researcherId: "R1",
      itemId: "q1",
      criteria: ["S1-WENT-WELL", "S1-NOT-WELL"],
      coded: true,
    });
    await saveReflectionCoding({
      sessionId: "974_2",
      researcherId: "R2",
      itemId: "q1",
      criteria: ["S1-WENT-WELL"],
      coded: true,
    });
    // Ticked but not marked: not coded yet.
    await saveReflectionCoding({
      sessionId: "974_2",
      researcherId: "R2",
      itemId: "q2",
      criteria: ["S1-WENT-WELL"],
      coded: false,
    });

    const participant = (await listAdminOverview()).find(
      (entry) => entry.participantCode === "974",
    );
    expect(participant?.sessions[2]?.reflectionCoding).toEqual({
      state: "submitted",
      moments: [
        { R1: 2, R2: 1 },
        { R1: null, R2: null },
      ],
    });
    expect(participant?.sessions[2]?.codedBy).toEqual([]);
    expect(participant?.sessions[3]?.reflectionCoding).toEqual({
      state: "not_submitted",
      moments: 2,
    });
  });
});
