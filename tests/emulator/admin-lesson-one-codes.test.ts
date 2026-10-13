import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  getAdminParticipantLesson,
  listAdminOverview,
  listResearcherCoding,
  loadLessonOneCodes,
  savePromptCoding,
} from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

const transcript = {
  source: {
    submittedLink: "https://gemini.google.com/share/abc123def456",
    shareUrl: "https://gemini.google.com/share/abc123def456",
    title: "Kodbyte",
    model: "Gemini",
    sharedAt: null,
  },
  retrievedAt: "2026-10-13T00:00:00.000Z",
  parserVersion: 2,
  warnings: [],
  messages: [
    { index: 1, role: "student", text: "Jag kopplade lysdioden." },
    { index: 2, role: "gemini", text: "Vad hände?" },
  ],
};

// Like the study: 981 got 982 after lesson 1 and nobody used 981 again, 982 got
// 983, 983 was only used from lesson 2 on, 984 kept its code and 985 is not in
// the mapping.
const MAPPING = { "981": "982", "982": "983", "984": "984" };

const mappingRef = () => getDb().doc("codeMappings/lessonOne");

async function session(id: string, status: string) {
  const [participantCode, lesson] = id.split("_");
  await getDb()
    .collection("sessions")
    .doc(id)
    .set({
      participantCode,
      lesson: Number(lesson),
      status,
      transcriptSubmission: "transcript",
      transcript,
      transcriptConfirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

beforeAll(async () => {
  await getDb().collection("participants").doc("981").set({ code: "981" });
  await session("981_1", "completed");
  await session("982_1", "awaiting_confirmation");
  await session("982_2", "completed");
  await session("983_2", "completed");
  await session("984_1", "completed");
  await session("984_2", "completed");
  await session("985_1", "completed");
});

beforeEach(async () => {
  await mappingRef().set({ codes: MAPPING });
});

afterAll(async () => {
  await mappingRef().delete();
});

async function overview(code: string) {
  return (await listAdminOverview()).find(
    (participant) => participant.participantCode === code,
  );
}

describe("lesson 1 code mapping", () => {
  test("shows each lesson 1 under the participant's later code", async () => {
    expect((await loadLessonOneCodes()).status).toBe("applied");

    const p982 = await overview("982");
    expect(p982?.sessions[1]).toMatchObject({
      state: "completed",
      submittedCode: "981",
    });
    expect(p982?.sessions[2]?.submittedCode).toBeUndefined();

    const p983 = await overview("983");
    expect(p983?.sessions[1]).toMatchObject({
      state: "started",
      submittedCode: "982",
    });
    expect(p983?.sessions[2]?.state).toBe("completed");

    expect((await overview("981"))?.sessions).toEqual({});
    expect((await overview("984"))?.sessions[1]?.submittedCode).toBeUndefined();
    expect((await overview("985"))?.sessions[1]?.state).toBe("completed");
  });

  test("opens a participant's lesson 1 from the code it was handed in under", async () => {
    const moved = await getAdminParticipantLesson("982", 1);
    expect(moved.session?.id).toBe("981_1");
    expect(moved.submittedCode).toBe("981");
    expect(moved.shownUnder).toBeNull();

    expect((await getAdminParticipantLesson("983", 1)).session?.id).toBe(
      "982_1",
    );
    expect((await getAdminParticipantLesson("982", 2)).session?.id).toBe(
      "982_2",
    );

    const kept = await getAdminParticipantLesson("984", 1);
    expect(kept.session?.id).toBe("984_1");
    expect(kept.submittedCode).toBeNull();

    const emptied = await getAdminParticipantLesson("981", 1);
    expect(emptied.session).toBeNull();
    expect(emptied.shownUnder).toBe("982");
  });

  test("saves coding to the session's own document, never through the mapping", async () => {
    // 982_1 is shown as participant 983's lesson 1; participant 982's lesson 1 is
    // 981_1. Coding saved for 982_1 must stay on 982_1.
    await savePromptCoding({
      sessionId: "982_1",
      researcherId: "R1",
      message: 1,
      note: "Kodad efter kodbytet",
      codes: [],
    });

    expect((await listResearcherCoding("982_1")).R1).toHaveLength(1);
    expect((await listResearcherCoding("981_1")).R1).toHaveLength(0);
    expect((await overview("983"))?.sessions[1]?.codedBy).toEqual(["R1"]);
    expect((await overview("982"))?.sessions[1]?.codedBy).toEqual([]);
  });

  test("ignores the whole mapping when a participant would get two lesson 1s", async () => {
    await session("983_1", "completed");
    try {
      expect(await loadLessonOneCodes()).toEqual({
        status: "ignored",
        problem: { kind: "conflict", code: "983" },
      });
      expect((await overview("982"))?.sessions[1]).toMatchObject({
        state: "started",
      });
      expect(
        (await overview("982"))?.sessions[1]?.submittedCode,
      ).toBeUndefined();
      expect((await getAdminParticipantLesson("982", 1)).session?.id).toBe(
        "982_1",
      );
    } finally {
      await getDb().doc("sessions/983_1").delete();
    }
  });

  test("ignores a mapping that gives two lesson 1 codes the same participant", async () => {
    await mappingRef().set({ codes: { "981": "982", "985": "982" } });
    expect(await loadLessonOneCodes()).toEqual({
      status: "ignored",
      problem: { kind: "duplicate", code: "982" },
    });
    expect((await getAdminParticipantLesson("982", 1)).session?.id).toBe(
      "982_1",
    );
  });

  test("shows sessions under the codes they were handed in under without a mapping", async () => {
    await mappingRef().delete();
    expect(await loadLessonOneCodes()).toEqual({ status: "none" });
    expect((await overview("981"))?.sessions[1]?.state).toBe("completed");
    expect((await getAdminParticipantLesson("981", 1)).session?.id).toBe(
      "981_1",
    );
  });
});
