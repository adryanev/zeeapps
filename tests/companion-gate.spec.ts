import { expect, test } from "@playwright/test";

test.describe("Companion Gate", () => {
  test("opens after the keyboard hold and Continue preserves the Child Stage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("child-stage")).toBeVisible();
    await expect(page.getByTestId("child-stage")).toHaveAttribute("aria-busy", "false");

    await page.keyboard.down("Shift");
    await page.keyboard.down("Enter");
    await expect(page.getByTestId("companion-gate")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
    await page.keyboard.up("Enter");
    await page.keyboard.up("Shift");

    await expect(page.getByTestId("companion-gate")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Return to Playroom" })).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).press("Enter");

    await expect(page.getByTestId("companion-gate")).toBeHidden();
    await expect(page.getByTestId("child-stage")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("isolates the Child Stage while open and resumes the same state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("child-stage")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    await page.keyboard.down("Shift");
    await page.keyboard.down("Enter");
    await expect(page.getByTestId("companion-gate")).toBeVisible({ timeout: 3_000 });
    await page.keyboard.up("Enter");
    await page.keyboard.up("Shift");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
    await page.getByTestId("child-stage").click({ position: { x: 820, y: 500 } });
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("companion-gate")).toBeHidden();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");
  });

  test("returns to the Playroom without duplicating the Game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("child-stage")).toHaveAttribute("aria-busy", "false");
    await openKeyboardGate(page);

    await page.getByRole("button", { name: "Return to Playroom" }).click();

    await expect(page.getByTestId("playroom")).toBeVisible();
    await expect(page.getByTestId("child-stage")).toBeHidden();
    await expect(page.locator("canvas")).toHaveCount(0);

    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("child-stage")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("does not open for ordinary keys, taps, or an incomplete hold", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("child-stage")).toHaveAttribute("aria-busy", "false");

    await page.keyboard.press("Shift");
    await page.keyboard.press("Enter");
    await page.mouse.click(180, 180);
    await page.keyboard.down("Shift");
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    await page.keyboard.up("Shift");

    await expect(page.getByTestId("companion-gate")).toBeHidden();
    await expect(page.getByTestId("child-stage")).toBeVisible();
  });

  test.describe("touch", () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });

    test("opens only when both top corners are held", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
      await expect(page.getByTestId("child-stage")).toHaveAttribute("aria-busy", "false");

      await holdTouchCorner(page, "companion-gate-touch-left", 1);
      await expect(page.getByTestId("companion-gate")).toBeHidden();
      await releaseTouchCorner(page, "companion-gate-touch-left", 1);

      await holdTouchCorner(page, "companion-gate-touch-left", 1);
      await holdTouchCorner(page, "companion-gate-touch-right", 2);
      await expect(page.getByTestId("companion-gate")).toBeVisible({ timeout: 3_000 });
      await releaseTouchCorner(page, "companion-gate-touch-left", 1);
      await releaseTouchCorner(page, "companion-gate-touch-right", 2);

      await expect(page.getByTestId("companion-gate")).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByTestId("child-stage")).toBeVisible();
    });
  });
});

async function openKeyboardGate(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.getByTestId("child-stage")).toHaveAttribute("aria-busy", "false");
  await page.keyboard.down("Shift");
  await page.keyboard.down("Enter");
  await expect(page.getByTestId("companion-gate")).toBeVisible({ timeout: 3_000 });
  await page.keyboard.up("Enter");
  await page.keyboard.up("Shift");
  await expect(page.getByTestId("companion-gate")).toBeVisible();
}

async function holdTouchCorner(
  page: import("@playwright/test").Page,
  testId: string,
  pointerId: number,
): Promise<void> {
  await page.evaluate(
    ({ pointerId, testId }) => {
      const corner = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!corner) {
        throw new Error(`Missing ${testId}`);
      }
      corner.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          isPrimary: pointerId === 1,
          pointerId,
          pointerType: "touch",
        }),
      );
    },
    { pointerId, testId },
  );
}

async function releaseTouchCorner(
  page: import("@playwright/test").Page,
  testId: string,
  pointerId: number,
): Promise<void> {
  await page.evaluate(
    ({ pointerId, testId }) => {
      const corner = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!corner) {
        throw new Error(`Missing ${testId}`);
      }
      corner.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          isPrimary: pointerId === 1,
          pointerId,
          pointerType: "touch",
        }),
      );
    },
    { pointerId, testId },
  );
}
