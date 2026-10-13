import { describe, expect, it } from "vitest";

import {
  codesToCheckForOwnLessonOne,
  lessonOneCodesFromCsv,
  parseLessonOneCodes,
  storedParticipantCode,
  studyParticipantCode,
  type LessonOneCodes,
} from "./lesson-one-codes";

// Made-up codes. Lesson 1 code → code in lessons 2–4: 731 became 738, 734 kept
// its code and 760 became 731, so nobody used 760 after lesson 1.
function sampleCodes(): LessonOneCodes {
  const parsed = parseLessonOneCodes({
    "731": "738",
    "734": "734",
    "760": "731",
  });
  if (!parsed.ok) throw new Error("sample must parse");
  return parsed.codes;
}

describe("parseLessonOneCodes", () => {
  it("reads a map of codes in both directions", () => {
    const codes = sampleCodes();
    expect(codes.toStudyCode.get("731")).toBe("738");
    expect(codes.toLessonOneCode.get("738")).toBe("731");
    expect(codes.toLessonOneCode.get("734")).toBe("734");
  });

  it("accepts numbers and normalises codes the way the login does", () => {
    const parsed = parseLessonOneCodes({ "073": 78, "7": "007" });
    expect(parsed.ok && Object.fromEntries(parsed.codes.toStudyCode)).toEqual({
      "73": "78",
      "7": "7",
    });
  });

  it("refuses two lesson 1 codes for the same participant", () => {
    expect(parseLessonOneCodes({ "731": "738", "732": "738" })).toEqual({
      ok: false,
      problem: { kind: "duplicate", code: "738" },
    });
  });

  it.each([
    ["no map", undefined],
    ["a list", ["731", "738"]],
    ["an empty map", {}],
    ["a code that is not a number", { "731": "abc" }],
    ["a code that is too long", { "731": "1000" }],
    ["code 0", { "0": "738" }],
    ["the same lesson 1 code twice", { "73": "78", "073": "79" }],
  ])("refuses %s", (_, value) => {
    expect(parseLessonOneCodes(value)).toEqual({
      ok: false,
      problem: { kind: "format" },
    });
  });
});

describe("studyParticipantCode", () => {
  it("moves only lesson 1 sessions handed in under a mapped code", () => {
    const codes = sampleCodes();
    expect(studyParticipantCode(codes, "731", 1)).toBe("738");
    expect(studyParticipantCode(codes, "760", 1)).toBe("731");
    expect(studyParticipantCode(codes, "731", 2)).toBe("731");
    expect(studyParticipantCode(codes, "705", 1)).toBe("705");
    expect(studyParticipantCode(null, "731", 1)).toBe("731");
  });
});

describe("storedParticipantCode", () => {
  it("finds the code a participant's lesson 1 was handed in under", () => {
    const codes = sampleCodes();
    expect(storedParticipantCode(codes, "738", 1)).toBe("731");
    expect(storedParticipantCode(codes, "731", 1)).toBe("760");
    expect(storedParticipantCode(codes, "734", 1)).toBe("734");
    expect(storedParticipantCode(codes, "705", 1)).toBe("705");
  });

  it("gives no lesson 1 to a code whose lesson 1 belongs to someone else", () => {
    expect(storedParticipantCode(sampleCodes(), "760", 1)).toBeNull();
  });

  it("leaves lessons 2–4 and a missing mapping alone", () => {
    expect(storedParticipantCode(sampleCodes(), "738", 2)).toBe("738");
    expect(storedParticipantCode(null, "738", 1)).toBe("738");
  });
});

describe("codesToCheckForOwnLessonOne", () => {
  it("lists later codes that nobody in the mapping used in lesson 1", () => {
    expect(codesToCheckForOwnLessonOne(sampleCodes())).toEqual(["738"]);
  });
});

describe("lessonOneCodesFromCsv", () => {
  it("reads the researchers' sheet", () => {
    expect(
      lessonOneCodesFromCsv(
        "Session 1,Session 2-4\r\n731,738\r\n 734 , 734 \r\n\r\n760,731\r\n",
      ),
    ).toEqual({ "731": "738", "734": "734", "760": "731" });
  });

  it("refuses rows that are not two codes", () => {
    expect(() => lessonOneCodesFromCsv("731,738\n732\n")).toThrow(/Row 2/);
    expect(() => lessonOneCodesFromCsv("731,738\n732,x\n")).toThrow(/Row 2/);
    expect(() => lessonOneCodesFromCsv("731,738,740\n")).toThrow(/Row 1/);
  });

  it("refuses a lesson 1 code that appears twice", () => {
    expect(() => lessonOneCodesFromCsv("731,738\n731,740\n")).toThrow(/twice/);
  });
});
