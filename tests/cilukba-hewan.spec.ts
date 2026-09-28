import { expect, test } from "@playwright/test";

test("Cilukba Hewan finds all twelve animals over four calm rounds on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai Cilukba Hewan" }).click();

  const board = page.locator(".cilukba-board");
  const spots = board.locator(".cilukba-spot");
  await expect(board).toBeVisible();
  await expect(spots).toHaveCount(3);
  const found = new Set<string>();

  for (let round = 0; round < 4; round += 1) {
    for (let index = 0; index < 3; index += 1) {
      const spot = spots.nth(index);
      await spot.click();
      await expect(spot).toHaveClass(/is-revealed/);
      found.add((await spot.getAttribute("aria-label"))!.split(",")[0]);
    }
    await expect(board.getByRole("button", { name: "Cilukba lagi" })).toBeVisible();
    if (round < 3) await board.getByRole("button", { name: "Cilukba lagi" }).click();
  }

  expect(found).toEqual(new Set(["kucing", "anjing", "ayam", "bebek", "kelinci", "sapi", "kuda", "kambing", "katak", "burung", "monyet", "gajah"]));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  for (const spot of await spots.all()) {
    const box = (await spot.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
});

test("Cilukba Hewan relaunches with every animal available offline", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai Cilukba Hewan" }).click();
  await expect(page.locator(".cilukba-board")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Mulai Cilukba Hewan" }).click();
  await expect(page.locator(".cilukba-board")).toBeVisible();
  await expect(page.getByTestId("game-load-error")).toBeHidden();

  for (let round = 0; round < 4; round += 1) {
    for (const spot of await page.locator(".cilukba-spot").all()) {
      await spot.click();
      await expect(spot).toHaveClass(/is-revealed/);
      const image = spot.locator(".cilukba-animal");
      expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    if (round < 3) await page.getByRole("button", { name: "Cilukba lagi" }).click();
  }
});

test("Companion Gate pauses Cilukba Hewan and returns to the Playroom cleanly", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("reduced-motion-toggle").check();
  await page.getByRole("button", { name: "Mulai Cilukba Hewan" }).click();
  await expect(page.locator(".cilukba-board")).toHaveAttribute("data-reduced-motion", "true");

  await page.keyboard.down("Shift");
  await page.keyboard.down("Enter");
  await expect(page.getByTestId("companion-gate")).toBeVisible({ timeout: 6_000 });
  await page.keyboard.up("Enter");
  await page.keyboard.up("Shift");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator(".cilukba-spot").first().click();
  await expect(page.locator(".cilukba-spot").first()).toHaveClass(/is-revealed/);

  await page.keyboard.down("Shift");
  await page.keyboard.down("Enter");
  await expect(page.getByTestId("companion-gate")).toBeVisible({ timeout: 6_000 });
  await page.keyboard.up("Enter");
  await page.keyboard.up("Shift");
  await page.getByRole("button", { name: "Return to Playroom" }).click();
  await expect(page.locator(".cilukba-board")).toHaveCount(0);
  await page.getByRole("button", { name: "Mulai Cilukba Hewan" }).click();
  await expect(page.locator(".cilukba-spot.is-revealed")).toHaveCount(0);
});
