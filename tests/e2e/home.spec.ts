import { expect, test } from "@playwright/test";

test("start page renders in Swedish", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByRole("heading", { name: "Logga in" })).toBeVisible();
  await expect(page.getByText(/Google/)).toHaveCount(0);
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
});
