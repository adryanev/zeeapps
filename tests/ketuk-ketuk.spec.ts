import { expect, test } from "@playwright/test";

test("Ketuk-Ketuk responds to keys and pauses behind the Companion Gate", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai Ketuk-Ketuk" }).click();
  const board = page.locator(".ketuk-board");
  const monster = board.locator(".ketuk-monster");
  await expect(board).toBeVisible();

  await page.keyboard.press("a");
  await expect(monster).toHaveAttribute("data-face", "wow");
  await expect(board.locator(".ketuk-bubble")).toHaveCount(3);

  await page.keyboard.down("Shift");
  await page.keyboard.down("Enter");
  await expect(page.getByTestId("companion-gate")).toBeVisible({ timeout: 6_000 });
  await page.keyboard.up("Enter");
  await page.keyboard.up("Shift");
  await page.evaluate(() => document.querySelector(".ketuk-board")!
    .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" })));
  await expect(monster).toHaveAttribute("data-face", "wow");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.keyboard.press("ArrowRight");
  await expect(monster).toHaveAttribute("data-face", "grin");

  await page.keyboard.down("Shift");
  await page.keyboard.down("Enter");
  await expect(page.getByTestId("companion-gate")).toBeVisible({ timeout: 6_000 });
  await page.keyboard.up("Enter");
  await page.keyboard.up("Shift");
  await page.getByRole("button", { name: "Return to Playroom" }).click();
  await expect(board).toHaveCount(0);
});

test("Ketuk-Ketuk supports phone taps, reduced motion, mute, and offline replay", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByTestId("reduced-motion-toggle").check();
  await page.getByRole("radio", { name: "Senyap" }).check();
  await page.getByRole("button", { name: "Mulai Ketuk-Ketuk" }).click();
  const board = page.locator(".ketuk-board");
  await expect(board).toHaveAttribute("data-reduced-motion", "true");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-sound-profile", "senyap");
  await board.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 1 });
  await expect(board.locator(".ketuk-monster")).toHaveAttribute("data-face", "wow");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Mulai Ketuk-Ketuk" }).click();
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("data-reduced-motion", "true");
  await expect(page.getByTestId("game-load-error")).toBeHidden();
});
