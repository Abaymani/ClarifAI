import { describe, expect, test } from "vitest";

import { demoMode } from "@/lib/demo";

const EMULATOR = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  GCLOUD_PROJECT: "demo-clarifai",
};

describe("demoMode", () => {
  test("is off unless switched on", () => {
    expect(demoMode({})).toBe(false);
    expect(demoMode({ ...EMULATOR })).toBe(false);
    expect(demoMode({ ...EMULATOR, CLARIFAI_DEMO: "true" })).toBe(false);
  });

  test("runs against the emulator's demo project", () => {
    expect(demoMode({ ...EMULATOR, CLARIFAI_DEMO: "1" })).toBe(true);
  });

  test("refuses to run without the emulator", () => {
    expect(() =>
      demoMode({ CLARIFAI_DEMO: "1", GCLOUD_PROJECT: "demo-clarifai" }),
    ).toThrow("Firestore emulator");
  });

  test("refuses any other project", () => {
    for (const GCLOUD_PROJECT of ["clarifai-19445", "demo-other", undefined]) {
      expect(() =>
        demoMode({ ...EMULATOR, CLARIFAI_DEMO: "1", GCLOUD_PROJECT }),
      ).toThrow("demo-clarifai");
    }
  });
});
