import { expect, test } from "@playwright/test";

test("start page renders in Swedish", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(
    page.getByRole("heading", { level: 1, name: "ClarifAI" }),
  ).toBeVisible();
});
