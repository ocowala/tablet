import { expect, test } from "@playwright/test";

/**
 * Flow tests. These need a running app pointed at a seeded Supabase project:
 *
 *   npm run seed
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 *
 * Without a seeded database the app has no text for today, which the first
 * test asserts explicitly rather than skipping over.
 */

test("opens straight onto the text with no landing screen", async ({ page }) => {
  await page.goto("/");

  // Nothing stands between the reader and the text.
  await expect(page.getByRole("button", { name: /begin|start|get started/i })).toHaveCount(0);

  const body = page.locator("[data-paragraph]");
  const empty = page.getByText("No text today.");
  await expect(body.first().or(empty)).toBeVisible();
});

test("keeps the header out of the way while reading", async ({ page }) => {
  await page.goto("/");
  const paragraphs = page.locator("[data-paragraph]");
  test.skip((await paragraphs.count()) === 0, "needs a seeded text for today");

  const appearance = page.getByRole("button", { name: "Appearance" });
  await expect(appearance).toBeVisible();

  await page.mouse.wheel(0, 900);
  await expect(appearance).not.toBeInViewport();

  await page.mouse.wheel(0, -120);
  await expect(appearance).toBeInViewport();
});

test("the Aa popover holds only appearance and highlight colour", async ({ page }) => {
  await page.goto("/");
  test.skip((await page.locator("[data-paragraph]").count()) === 0, "needs a seeded text");

  await page.getByRole("button", { name: "Appearance" }).click();
  const popover = page.getByRole("dialog", { name: "Appearance" });
  await expect(popover).toBeVisible();

  await expect(popover.getByRole("button", { name: "light" })).toBeVisible();
  await expect(popover.getByRole("button", { name: "dark" })).toBeVisible();
  await expect(popover.getByRole("button", { name: "auto" })).toBeVisible();
  await expect(popover.getByRole("button", { name: "Highlight yellow" })).toBeVisible();
  await expect(popover.getByRole("button", { name: "Highlight blue" })).toBeVisible();

  await popover.getByRole("button", { name: "dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("a question surfaces only after the reader has stayed with the text", async ({ page }) => {
  await page.goto("/");
  const paragraphs = page.locator("[data-paragraph]");
  test.skip((await paragraphs.count()) === 0, "needs a seeded text");

  // It is not there the moment the page opens.
  await expect(page.getByLabel("Your answer")).toHaveCount(0);

  await paragraphs.last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);

  // Surfacing also waits on min_seconds, so this is the earliest it can appear.
  const question = page.getByLabel("Close the question and reread");
  await expect(question.or(page.getByLabel("Your answer"))).toBeVisible({ timeout: 120_000 });
});

test("never shows a raw score or a threshold", async ({ page }) => {
  const responses: string[] = [];
  page.on("response", async (response) => {
    if (!response.url().includes("/api/")) return;
    try {
      responses.push(await response.text());
    } catch {
      // Redirects and empty bodies are not interesting here.
    }
  });

  await page.goto("/");
  await page.waitForTimeout(1500);

  for (const body of responses) {
    expect(body).not.toContain("pass_percentile");
    expect(body).not.toContain("\"score\"");
    expect(body).not.toContain("rubric");
  }
});
