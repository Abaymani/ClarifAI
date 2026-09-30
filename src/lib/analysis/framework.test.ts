import { describe, expect, it } from "vitest";

import { AnalysisError } from "./errors";
import {
  assertFrameworkAllowed,
  FRAMEWORK_FILES,
  loadFramework,
  parseFramework,
  textsOf,
  type FrameworkFiles,
} from "./framework";
import { testFramework, testFrameworkFiles } from "./test-fixtures";

function problemsOf(action: () => unknown): string[] {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AnalysisError);
    expect((error as AnalysisError).code).toBe("S2-FRAMEWORK");
    return (error as AnalysisError).problems;
  }
  throw new Error("expected the framework to be rejected");
}

const rejected = (files: FrameworkFiles) =>
  problemsOf(() => parseFramework(files));

// Holds for whatever the researchers commit, TEST or final; nothing else in the
// tests depends on the contents of `framework/`.
describe("the framework in framework/", () => {
  it("loads and is consistent", () => {
    const framework = loadFramework();
    expect(framework.promptCodes.length).toBeGreaterThan(0);
    expect(framework.sequencePatterns.length).toBeGreaterThan(0);
    expect(textsOf(framework.generalGroup).questions.length).toBeGreaterThan(0);
    expect(framework.isTest).toBe(framework.status === "TEST");
  });
});

describe("loadFramework", () => {
  function reader(overrides: Record<string, string | null> = {}) {
    const files = testFrameworkFiles();
    const contents: Record<string, string | null> = {
      [FRAMEWORK_FILES.promptCoding]: JSON.stringify(files.promptCoding),
      [FRAMEWORK_FILES.sequenceCoding]: JSON.stringify(files.sequenceCoding),
      [FRAMEWORK_FILES.grouping]: JSON.stringify(files.grouping),
      [FRAMEWORK_FILES.codingGuidelines]: files.codingGuidelines,
      [FRAMEWORK_FILES.reflectionGuidelines]: "Reflection guidance.\n",
      ...overrides,
    };
    return (name: string) => contents[name] ?? null;
  }

  it("reads the framework files", () => {
    const framework = loadFramework(reader());
    expect(framework.version).toBe("TEST-fixture");
    expect(framework.groupByCode.get("P3")?.code).toBe("R2");
    expect(framework.reflectionGuidelines).toBe("Reflection guidance.");
  });

  it("works without separate reflection guidelines", () => {
    const framework = loadFramework(
      reader({ [FRAMEWORK_FILES.reflectionGuidelines]: null }),
    );
    expect(framework.reflectionGuidelines).toBeNull();
  });

  it("names the file that is missing or broken", () => {
    expect(
      problemsOf(() =>
        loadFramework(reader({ [FRAMEWORK_FILES.codingGuidelines]: null })),
      ),
    ).toEqual(["analysis_guidelines.md: cannot be read"]);
    expect(
      problemsOf(() =>
        loadFramework(reader({ [FRAMEWORK_FILES.grouping]: "{ not json" })),
      ),
    ).toEqual(["behaviour_grouping.JSON: not valid JSON"]);
  });
});

// These guard the hand-over when the researchers replace the TEST framework.
describe("parseFramework", () => {
  it("rejects a code that belongs to no group", () => {
    const files = testFrameworkFiles();
    files.grouping.groups[1].behaviourCodes = [];
    expect(rejected(files)).toContain("code P3 is in no group");
  });

  it("rejects a code in two groups, or one the framework doesn't define", () => {
    const files = testFrameworkFiles();
    files.grouping.groups[0].behaviourCodes.push("P3", "X1");
    expect(rejected(files)).toEqual(
      expect.arrayContaining([
        "code P3 is in more than one group",
        "group R1: unknown code X1",
      ]),
    );
  });

  it("rejects files from different framework versions", () => {
    const files = testFrameworkFiles();
    files.grouping.version = "TEST-other";
    expect(rejected(files)).toContain(
      "behaviour_grouping.JSON: status or version differs from the prompt codes",
    );
  });

  it("needs an intro and a question for every group a student can get", () => {
    const files = testFrameworkFiles();
    files.grouping.groups[0].questions = [];
    files.grouping.groups.find((g) => g.kind === "none")!.intro = "Text.";
    expect(rejected(files)).toEqual([
      "group R1: needs an intro and a question",
      'group RN: a "none" group has no texts',
    ]);
  });

  // Only the intro and questions of behaviour groups are fitted to the student;
  // everything else reaches them exactly as written.
  it("rejects brackets in texts that are shown as written", () => {
    const files = testFrameworkFiles();
    files.grouping.groups[0].tip = "Jag valde [det här] eftersom …";
    files.grouping.groups.find((g) => g.kind === "general")!.intro =
      "Här [hände något].";
    expect(rejected(files)).toEqual([
      "group R1: brackets in a text shown as written",
      "group R0: brackets in a text shown as written",
    ]);
  });

  it("needs exactly one general group, and at most one for students without a transcript", () => {
    const files = testFrameworkFiles();
    const general = files.grouping.groups.find((g) => g.kind === "general")!;
    general.behaviourCodes = ["P1"];
    expect(rejected(files)).toEqual(
      expect.arrayContaining([
        "group R0: cannot have behaviour codes",
        "code P1 is in more than one group",
      ]),
    );

    const doubled = testFrameworkFiles();
    doubled.grouping.groups.push({
      ...doubled.grouping.groups.find((g) => g.kind === "no_transcript")!,
      code: "R02",
    });
    expect(rejected(doubled)).toEqual(["at most one no_transcript group"]);

    const missing = testFrameworkFiles();
    missing.grouping.groups = missing.grouping.groups.filter(
      (g) => g.kind !== "general",
    );
    expect(rejected(missing)).toEqual(["needs exactly one general group"]);
  });

  it("names the field when a file has the wrong shape", () => {
    const files = testFrameworkFiles();
    (files.grouping.groups[2] as { kind: string }).kind = "praise";
    expect(rejected(files)[0]).toMatch(
      /^behaviour_grouping\.JSON: groups\.2\.kind/,
    );
  });

  it("needs coding guidelines, while reflection guidelines are optional", () => {
    expect(
      rejected({ ...testFrameworkFiles(), codingGuidelines: "  \n" }),
    ).toEqual(["coding guidelines empty"]);

    for (const reflectionGuidelines of [null, " \n"]) {
      const framework = parseFramework({
        ...testFrameworkFiles(),
        reflectionGuidelines,
      });
      expect(framework.reflectionGuidelines).toBeNull();
    }
  });
});

describe("assertFrameworkAllowed", () => {
  const framework = testFramework();

  it("refuses a TEST framework in production", () => {
    expect(() =>
      assertFrameworkAllowed(framework, { VERCEL_ENV: "production" }),
    ).toThrow(expect.objectContaining({ code: "S2-TEST-FRAMEWORK" }));
  });

  it("allows it locally and on previews", () => {
    expect(() => assertFrameworkAllowed(framework, {})).not.toThrow();
    expect(() =>
      assertFrameworkAllowed(framework, { VERCEL_ENV: "preview" }),
    ).not.toThrow();
  });
});
