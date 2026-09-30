import { expect, test } from "@playwright/test";

import {
  getSessionData,
  seedCompletedSession,
  seedFailedAnalysis,
  seedParticipant,
  seedTranscriptForConfirmation,
} from "./seed";

async function logIn(
  page: import("@playwright/test").Page,
  code: string,
  pin: string,
  lesson: number,
): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Deltagarkod").fill(code);
  await page.getByLabel("PIN-kod").fill(pin);
  await page.getByText(`Lektion ${lesson}`, { exact: true }).click();
  await page.getByRole("button", { name: "Starta" }).click();
}

test("starts a session with the right code and PIN", async ({ page }) => {
  await seedParticipant("901", "4321");

  await logIn(page, "901", "4321", 2);

  await expect(
    page.getByRole("heading", { name: "Sessionen är igång" }),
  ).toBeVisible();
  await expect(page.getByText("Deltagare 901 · Lektion 2")).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Jag använde Gemini/ }),
  ).toBeChecked();
  await expect(page.getByLabel("Länk till din Gemini-chatt")).toBeEnabled();
});

test("records no Gemini and completes lesson 1 without a reflection", async ({
  page,
}) => {
  await seedParticipant("912", "4321");
  await logIn(page, "912", "4321", 1);

  await page.getByRole("radio", { name: /Jag använde inte Gemini/ }).click();
  await expect(page.getByLabel("Länk till din Gemini-chatt")).toBeHidden();
  await page.getByRole("button", { name: "Fortsätt" }).click();

  await expect(
    page.getByText("Tack! Din inlämning har registrerats."),
  ).toBeVisible();
  expect(await getSessionData("912", 1)).toMatchObject({
    status: "completed",
    transcriptSubmission: "no_gemini",
    transcript: null,
  });
});

test("shows R01 and saves a reflection when Gemini was not used in lesson 2", async ({
  page,
}) => {
  await seedParticipant("913", "4321");
  await logIn(page, "913", "4321", 2);

  await page.getByRole("radio", { name: /Jag använde inte Gemini/ }).click();
  await page.getByRole("button", { name: "Fortsätt" }).click();

  await expect(
    page.getByRole("heading", { name: "Dags att reflektera" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Du uppgav att du inte använde Gemini under denna lektionen.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Vad motiverade dig för att inte använda det?"),
  ).toBeVisible();
  await expect(page.getByText("Känner du igen dig i analysen?")).toHaveCount(0);

  await page
    .getByLabel("Ditt svar")
    .fill("Jag heter Ada Lovelace och ville prova själv.");
  await page.getByRole("button", { name: "Lämna in reflektionen" }).click();
  await expect(
    page.getByText("Tack! Din reflektion har lämnats in."),
  ).toBeVisible();

  expect(await getSessionData("913", 2)).toMatchObject({
    status: "completed",
    transcriptSubmission: "no_gemini",
    reflectionQuestions: {
      outcome: "no_transcript",
      items: [{ group: "R01", groupKind: "no_transcript" }],
    },
    reflectionResponses: {
      items: [
        {
          itemId: "q1",
          answer: "Jag heter [REDACTED NAME] och ville prova själv.",
          agreement: null,
        },
      ],
    },
  });
});

test("keeps the student out with a wrong PIN and counts the attempt", async ({
  page,
}) => {
  await seedParticipant("902", "4321");

  await logIn(page, "902", "0000", 1);

  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Fel PIN-kod. Du har 2 försök kvar.",
  );
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Tala med din lärare",
  );
});

test("explains that an unknown code does not exist", async ({ page }) => {
  await logIn(page, "999", "4321", 1);

  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Koden finns inte",
  );
});

test("will not reopen a lesson that is already handed in", async ({ page }) => {
  await seedParticipant("903", "4321");
  await seedCompletedSession("903", 1);

  await logIn(page, "903", "4321", 1);

  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Lektion 1 är redan inlämnad",
  );
});

test("resumes the session after a reload and logs out again", async ({
  page,
}) => {
  await seedParticipant("904", "4321");

  await logIn(page, "904", "4321", 3);
  await expect(
    page.getByRole("heading", { name: "Sessionen är igång" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("Deltagare 904 · Lektion 3")).toBeVisible();

  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page.getByRole("heading", { name: "Logga in" })).toBeVisible();
});

test("sends visitors without a session back to the login page", async ({
  page,
}) => {
  await page.goto("/session");

  await expect(page.getByRole("heading", { name: "Logga in" })).toBeVisible();
});

test("keeps what the student typed after a failed attempt", async ({
  page,
}) => {
  await seedParticipant("905", "4321");

  await logIn(page, "905", "0000", 2);
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Fel PIN-kod",
  );

  // Only the PIN should need correcting; the code and lesson must survive.
  await expect(page.getByLabel("Deltagarkod")).toHaveValue("905");
  await expect(page.getByRole("radio", { name: "Lektion 2" })).toBeChecked();
  // The value that is actually submitted, not just what the radio looks like.
  await expect(page.locator('input[name="lesson"]')).toHaveValue("2");

  await page.getByLabel("PIN-kod").fill("4321");
  await page.getByRole("button", { name: "Starta" }).click();
  await expect(
    page.getByRole("heading", { name: "Sessionen är igång" }),
  ).toBeVisible();
});

test("can retry straight after a wrong PIN without touching the form", async ({
  page,
}) => {
  await seedParticipant("906", "4321");

  await logIn(page, "906", "0000", 2);
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Fel PIN-kod",
  );

  // Pressing the button again must complain about the PIN, not the lesson.
  await page.getByRole("button", { name: "Starta" }).click();
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Fel PIN-kod",
  );
});

test("rejects a non-Gemini link and keeps it available to correct", async ({
  page,
}) => {
  await seedParticipant("907", "4321");
  await logIn(page, "907", "4321", 2);

  const link = page.getByLabel("Länk till din Gemini-chatt");
  await link.fill("https://example.com/not-a-chat");
  await page.getByRole("button", { name: "Lämna in" }).click();

  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "inte en giltig Gemini-delning",
  );
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "S1-INVALID-LINK",
  );
  await expect(link).toHaveValue("https://example.com/not-a-chat");
});

test("shows the transcript preview and lets the student reject it", async ({
  page,
}) => {
  await seedParticipant("908", "4321");
  await seedTranscriptForConfirmation("908", 2);
  await logIn(page, "908", "4321", 2);

  await expect(
    page.getByRole("heading", { name: "Är det här ditt transkript?" }),
  ).toBeVisible();
  await expect(page.getByText("Hur kopplar jag en lysdiod?")).toBeVisible();
  await expect(page.getByText("Använd ett seriemotstånd")).toBeVisible();

  await page.getByRole("button", { name: "Nej, välj en annan länk" }).click();
  await expect(page.getByLabel("Länk till din Gemini-chatt")).toBeEnabled();
});

test("confirmation completes lesson 1 and returns a receipt", async ({
  page,
}) => {
  await seedParticipant("909", "4321");
  await seedTranscriptForConfirmation("909", 1);
  await logIn(page, "909", "4321", 1);

  await page.getByRole("button", { name: "Ja, fortsätt" }).click();
  await expect(
    page.getByText("Tack! Ditt transkript har lämnats in."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Logga in" })).toBeVisible();
});

test("confirmation analyses lesson 3 and shows the reflection questions", async ({
  page,
}) => {
  await seedParticipant("910", "4321");
  await seedTranscriptForConfirmation("910", 3);
  await logIn(page, "910", "4321", 3);

  await page.getByRole("button", { name: "Ja, fortsätt" }).click();
  await expect(
    page.getByRole("heading", { name: "Vi analyserar din chatt" }),
  ).toBeVisible();

  // The browser tests use the fake analyser; the page polls until it is done.
  await expect(
    page.getByRole("heading", { name: "Dags att reflektera" }),
  ).toBeVisible({ timeout: 15_000 });
  // The example shows the quoted prompt with the answer that followed it, tinted
  // by whether the group reflects or reinforces.
  const example = page.locator("section[data-tone]").first();
  await expect(example).toHaveAttribute("data-tone", "reflect");
  await expect(example).toContainText("1. Du");
  await expect(example).toContainText("Hur kopplar jag en lysdiod?");
  await expect(example).toContainText("2. Gemini");
  await expect(example).toContainText("Använd ett seriemotstånd");
  // The intro and the questions come from the behaviour group's texts.
  await expect(example).toContainText("FAKE:");
  await expect(example.getByRole("listitem").first()).toBeVisible();
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Testanalys utan AI",
  );
  await expect(
    example.getByText("Så här tolkar analysen exemplet"),
  ).toBeVisible();
  await expect(
    example.getByText(/Analysen kan ha missat vad du tänkte/),
  ).toBeVisible();
  await expect(
    example.getByRole("radio", { name: "Delvis", exact: true }),
  ).toBeEnabled();
  await expect(
    example.getByLabel("Hur ser du själv på exemplet?"),
  ).toBeEnabled();

  await example.getByRole("radio", { name: "Delvis", exact: true }).click();
  await expect(example).toContainText(
    "Förklara i fritextrutan vad som stämmer",
  );
  await example.getByRole("radio", { name: "Ja", exact: true }).click();
  await expect(example).not.toContainText(
    "Förklara i fritextrutan vad som stämmer",
  );

  // The questions are stored, so they are still there after a reload.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dags att reflektera" }),
  ).toBeVisible();
});

test("stores agreement and every free-text reflection answer", async ({
  page,
}) => {
  await seedParticipant("914", "4321");
  await seedTranscriptForConfirmation("914", 3);
  await logIn(page, "914", "4321", 3);
  await page.getByRole("button", { name: "Ja, fortsätt" }).click();
  await expect(
    page.getByRole("heading", { name: "Dags att reflektera" }),
  ).toBeVisible({ timeout: 15_000 });

  const examples = page.locator("section[data-tone]");
  const count = await examples.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const example = examples.nth(i);
    await example
      .getByRole("radio", {
        name: i === 0 ? "Nej" : "Ja",
        exact: true,
      })
      .click();
    await example
      .getByLabel("Hur ser du själv på exemplet?")
      .fill(`Mitt svar på exempel ${i + 1}.`);
  }
  await expect(examples.first()).toContainText(
    "Förklara i fritextrutan varför analysen inte stämmer",
  );

  await page.getByRole("button", { name: "Lämna in reflektionen" }).click();
  await expect(
    page.getByText("Tack! Din reflektion har lämnats in."),
  ).toBeVisible();

  const session = await getSessionData("914", 3);
  expect(session).toMatchObject({ status: "completed" });
  expect(session?.reflectionResponses.items).toHaveLength(count);
  expect(session?.reflectionResponses.items[0]).toMatchObject({
    agreement: "no",
    answer: "Mitt svar på exempel 1.",
  });
});

test("lets the student restart a failed analysis", async ({ page }) => {
  await seedParticipant("911", "4321");
  await seedFailedAnalysis("911", 2, "S2-OPENAI");
  await logIn(page, "911", "4321", 2);

  await expect(
    page.getByRole("heading", { name: "Analysen blev inte klar" }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="alert"]')).toContainText("S2-OPENAI");

  await page.getByRole("button", { name: "Försök igen" }).click();
  await expect(
    page.getByRole("heading", { name: "Dags att reflektera" }),
  ).toBeVisible({ timeout: 15_000 });
});
