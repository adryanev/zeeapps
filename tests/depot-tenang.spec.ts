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

  test("completes the truck Vehicle Journey without dragging", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });

    await page.getByTestId("child-stage").click({ position: { x: 820, y: 500 } });

    await expect(page.getByTestId("game-status")).toHaveText("Truk kembali ke garasi");
    await expect(page.getByTestId("game-status")).toHaveText("Truk tenang di garasi", {
      timeout: 3_000,
    });
  });

  test("uses Soft Grab for optional cargo exploration", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });

    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();

    const cargo = { x: (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.42, y: (bounds?.y ?? 0) + 300 };
    await page.mouse.move(cargo.x, cargo.y);
    await page.mouse.down();
    await expect(page.getByTestId("game-status")).toHaveText("Muatan bergerak perlahan");
    await page.mouse.move(cargo.x + 85, cargo.y - 40, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByTestId("game-status")).toHaveText("Muatan dilepas dengan lembut");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk kembali ke garasi");
  });

  test("gently recovers cargo moved to an unreachable edge", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });

    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();

    const cargo = { x: (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.42, y: (bounds?.y ?? 0) + 300 };
    await page.mouse.move(cargo.x, cargo.y);
    await page.mouse.down();
    await page.mouse.move((bounds?.x ?? 0) + 4, (bounds?.y ?? 0) + 4, { steps: 8 });

    await expect(page.getByTestId("game-status")).toHaveText("Muatan kembali perlahan", {
      timeout: 3_000,
    });
    await page.mouse.up();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });
  });

  test("locks rapid input to one truck step at a time", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    await page.keyboard.press("ArrowRight");
    await Promise.all(
      Array.from({ length: 12 }, (_, index) => page.keyboard.press(index % 2 ? "Space" : "Enter")),
    );
    await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });

    await Promise.all(Array.from({ length: 12 }, () => page.keyboard.press("ArrowRight")));
    await expect(page.getByTestId("game-status")).toHaveText("Truk kembali ke garasi");
    await expect(page.getByTestId("game-status")).toHaveText("Truk tenang di garasi", {
      timeout: 3_000,
    });
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

  test("completes the airplane Vehicle Journey from the hangar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();

    await page.mouse.click(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.83,
      (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.47,
    );

    await expect(page.getByTestId("game-status")).toHaveText("Pesawat lepas landas");
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat terbang di koridor aman", {
      timeout: 3_000,
    });

    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat kembali ke hangar");
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat tenang di hangar", {
      timeout: 3_000,
    });
  });

  test("keeps rapid airplane input inside one safe journey", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();

    await page.mouse.click(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.83,
      (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.47,
    );
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat terbang di koridor aman", {
      timeout: 3_000,
    });

    await Promise.all(
      Array.from({ length: 20 }, (_, index) => page.keyboard.press(index % 2 ? "ArrowDown" : "ArrowUp")),
    );

    await expect(page.getByTestId("game-status")).toHaveText("Pesawat kembali ke hangar");
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat tenang di hangar", {
      timeout: 3_000,
    });
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.getByTestId("active-vehicle")).toHaveText("Belum ada kendaraan aktif");
    expect(pageErrors).toEqual([]);
  });

  test("gently recovers an airplane dragged beyond the flight corridor", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();

    await page.mouse.click(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.83,
      (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.47,
    );
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat terbang di koridor aman", {
      timeout: 3_000,
    });
    await page.waitForTimeout(2_000);

    const airplane = {
      x: (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.5,
      y: (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.28,
    };
    await page.mouse.move(airplane.x, airplane.y);
    await page.mouse.down();
    await page.mouse.move((bounds?.x ?? 0) + 4, (bounds?.y ?? 0) + 4, { steps: 8 });

    await expect(page.getByTestId("game-status")).toHaveText("Pesawat kembali perlahan", {
      timeout: 3_000,
    });
    await page.mouse.up();
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat terbang di koridor aman", {
      timeout: 3_000,
    });
  });
});
