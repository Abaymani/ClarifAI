import { describe, expect, test } from "vitest";

import {
  firebaseWebAuthConfig,
  localEmulatorResearcher,
  researcherForClaims,
} from "@/lib/admin/auth";

const env = {
  ADMIN_RESEARCHER_1_EMAIL: "one@example.test",
  ADMIN_RESEARCHER_2_EMAIL: "two@example.test",
};

function claims(email: string, verified = true, provider = "google.com") {
  return {
    email,
    email_verified: verified,
    firebase: {
      identities: {},
      sign_in_provider: provider,
    },
  };
}

describe("researcherForClaims", () => {
  test("maps the two exact verified Google emails to stable researcher IDs", () => {
    expect(researcherForClaims(claims(" ONE@example.test "), env)).toEqual({
      id: "R1",
      email: "one@example.test",
    });
    expect(researcherForClaims(claims("two@example.test"), env)?.id).toBe("R2");
  });

  test("rejects unlisted, unverified, and non-Google identities", () => {
    expect(researcherForClaims(claims("other@example.test"), env)).toBeNull();
    expect(
      researcherForClaims(claims("one@example.test", false), env),
    ).toBeNull();
    expect(
      researcherForClaims(claims("one@example.test", true, "password"), env),
    ).toBeNull();
  });
});

describe("firebaseWebAuthConfig", () => {
  test("fails closed when production web configuration is absent", () => {
    expect(firebaseWebAuthConfig({})).toBeNull();
  });

  test("uses a harmless API key with the local Auth emulator", () => {
    expect(
      firebaseWebAuthConfig({
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        GCLOUD_PROJECT: "demo-clarifai",
      }),
    ).toEqual({
      apiKey: "demo-key",
      authDomain: "demo-clarifai.firebaseapp.com",
      projectId: "demo-clarifai",
      emulatorUrl: "http://127.0.0.1:9099",
    });
  });
});

describe("localEmulatorResearcher", () => {
  test("opens the local demo emulators as R1 without a login", () => {
    expect(
      localEmulatorResearcher({
        NODE_ENV: "development",
        GCLOUD_PROJECT: "demo-clarifai",
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
        ADMIN_RESEARCHER_1_EMAIL: "local-armin@example.test",
      }),
    ).toEqual({ id: "R1", email: "local-armin@example.test" });
  });

  test("fails closed outside the complete non-production demo setup", () => {
    const complete = {
      NODE_ENV: "development",
      GCLOUD_PROJECT: "demo-clarifai",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    };

    expect(
      localEmulatorResearcher({ ...complete, NODE_ENV: "production" }),
    ).toBeNull();
    expect(
      localEmulatorResearcher({ ...complete, GCLOUD_PROJECT: "clarifai" }),
    ).toBeNull();
    expect(
      localEmulatorResearcher({
        ...complete,
        FIRESTORE_EMULATOR_HOST: undefined,
      }),
    ).toBeNull();
  });
});
