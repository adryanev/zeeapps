import { expect, test } from "@playwright/test";

test.describe("Depot Tenang", () => {
  test("starts from the Playroom and responds to the Explorer's keyboard input", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("playroom").getByRole("heading", { name: "Depot Tenang" })).toBeVisible();
    await expect(page.getByTestId("companion-prompt")).toContainText("tunjuk kendaraan");
    await expect(page.getByTestId("child-stage")).toBeHidden();

    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

    await expect(page.getByTestId("child-stage")).toBeVisible();
    await expect(page.getByTestId("playroom")).toBeHidden();
    await expect(page.getByTestId("stage-title")).toHaveText("Depot Tenang");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
    await expect(page.locator("canvas")).toBeVisible();

    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");
    await expect(page.getByTestId("active-vehicle")).toHaveText("Truk aktif");
  });

  test("accepts an empty-stage tap as the first vehicle response", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

    await page.getByTestId("child-stage").click({ position: { x: 100, y: 100 } });

    await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");
  });

  test("keeps one Active Vehicle during repeated and random input", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

    for (const key of ["a", "Space", "ArrowUp", "Enter", "ArrowRight"]) {
      await page.keyboard.press(key);
    }

    await page.getByTestId("child-stage").click({ position: { x: 160, y: 160 } });
    await page.getByTestId("child-stage").click({ position: { x: 220, y: 180 } });

    await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");
    await expect(page.getByTestId("active-vehicle")).toHaveText("Truk aktif");
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page).toHaveURL("/");
    expect(pageErrors).toEqual([]);
  });
});
