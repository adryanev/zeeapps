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

  test("completes the fixed truck, train, and airplane Play Cycle", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

    await expect(page.getByTestId("diorama-time")).toHaveText("Afternoon");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("game-status")).toHaveText("Truk tenang di garasi", {
      timeout: 3_000,
    });
    await expect(page.getByTestId("diorama-time")).toHaveText("Late afternoon");

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta di stasiun", {
      timeout: 3_000,
    });
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta tenang di depot", {
      timeout: 3_000,
    });
    await expect(page.getByTestId("diorama-time")).toHaveText("Late afternoon");

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat terbang di koridor aman", {
      timeout: 3_000,
    });
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat tenang di hangar", {
      timeout: 3_000,
    });
    await expect(page.getByTestId("diorama-time")).toHaveText("Dusk");
    await expect(page.getByTestId("play-cycle-state")).toHaveText("Quiet State");

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await page.getByTestId("child-stage").click({ position: { x: 820, y: 500 } });
    await page.getByTestId("child-stage").click({ position: { x: 820, y: 500 } });
    await page.getByTestId("child-stage").click({ position: { x: 820, y: 500 } });
    await expect(page.getByTestId("play-cycle-state")).toHaveText("Quiet State");
    await expect(page.getByTestId("game-status")).toHaveText("Depot tetap tenang");
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("requires three calm activity beats before each vehicle returns", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    const status = page.getByTestId("game-status");

    await page.keyboard.press("ArrowRight");
    await expect(status).toHaveText("Truk menurunkan muatan", { timeout: 3_000 });
    await page.keyboard.press("Space");
    await expect(status).toHaveText("Truk menurunkan muatan");
    await page.keyboard.press("Space");
    await expect(status).toHaveText("Truk menurunkan muatan");
    await page.keyboard.press("Space");
    await expect(status).toHaveText("Truk kembali ke garasi");
    await expect(status).toHaveText("Truk tenang di garasi", { timeout: 3_000 });

    await page.keyboard.press("ArrowRight");
    await expect(status).toHaveText("Kereta di stasiun", { timeout: 3_000 });
    await page.keyboard.press("Enter");
    await expect(status).toHaveText("Kereta di stasiun");
    await page.keyboard.press("Enter");
    await expect(status).toHaveText("Kereta di stasiun");
    await page.keyboard.press("Enter");
    await expect(status).toHaveText("Kereta kembali ke depot");
    await expect(status).toHaveText("Kereta tenang di depot", { timeout: 3_000 });

    await page.keyboard.press("ArrowRight");
    await expect(status).toHaveText("Pesawat terbang di koridor aman", { timeout: 3_000 });
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await expect(status).toHaveText("Pesawat terbang di koridor aman");
    await page.keyboard.press("ArrowUp");
    await expect(status).toHaveText("Pesawat kembali ke hangar");
    await expect(status).toHaveText("Pesawat tenang di hangar", { timeout: 3_000 });
  });

  test("fits an unhurried Play Cycle in the three-to-five-minute virtual window", async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    const status = page.getByTestId("game-status");
    await expect(status).toHaveText("Truk menunggu di garasi");

    await page.clock.install();
    const startedAt = await page.evaluate(() => performance.now());
    const expectStatus = async (expected: string): Promise<void> => {
      expect(await status.textContent()).toBe(expected);
    };
    // Nine beats at the documented ~20-second unhurried toddler pace yield 180 seconds.
    const unhurriedBeat = async (): Promise<void> => {
      await page.clock.fastForward(20_000);
    };
    const settleMovement = async (): Promise<void> => {
      await page.clock.runFor(2_000);
    };

    await page.keyboard.press("ArrowRight");
    await settleMovement();
    await expectStatus("Truk menurunkan muatan");
    await unhurriedBeat();
    await page.keyboard.press("Space");
    await expectStatus("Truk menurunkan muatan");
    await unhurriedBeat();
    await page.keyboard.press("Space");
    await expectStatus("Truk menurunkan muatan");
    await unhurriedBeat();
    await page.keyboard.press("Space");
    await settleMovement();
    await expectStatus("Truk tenang di garasi");

    await page.keyboard.press("ArrowRight");
    await settleMovement();
    await expectStatus("Kereta di stasiun");
    await unhurriedBeat();
    await page.keyboard.press("Enter");
    await expectStatus("Kereta di stasiun");
    await unhurriedBeat();
    await page.keyboard.press("Enter");
    await expectStatus("Kereta di stasiun");
    await unhurriedBeat();
    await page.keyboard.press("Enter");
    await page.clock.runFor(3_000);
    await expectStatus("Kereta tenang di depot");

    await page.keyboard.press("ArrowRight");
    await settleMovement();
    await expectStatus("Pesawat terbang di koridor aman");
    await unhurriedBeat();
    await page.keyboard.press("ArrowUp");
    await expectStatus("Pesawat terbang di koridor aman");
    await unhurriedBeat();
    await page.keyboard.press("ArrowDown");
    await expectStatus("Pesawat terbang di koridor aman");
    await unhurriedBeat();
    await page.keyboard.press("ArrowUp");
    await page.clock.runFor(3_000);
    await expectStatus("Pesawat tenang di hangar");
    expect(await page.getByTestId("play-cycle-state").textContent()).toBe("Quiet State");

    const elapsed = await page.evaluate((started) => performance.now() - started, startedAt);
    expect(elapsed).toBeGreaterThanOrEqual(180_000);
    expect(elapsed).toBeLessThanOrEqual(300_000);
  });

  test("accepts an empty-stage tap as the first vehicle response", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

    await page.getByTestId("child-stage").click({ position: { x: 100, y: 100 } });

    await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");
  });

  test("selects the truck at its Resting Place before the Explorer starts its journey", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();

    await page.mouse.click(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.14,
      (bounds?.y ?? 0) + 338,
    );

    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
    await expect(page.getByTestId("active-vehicle")).toHaveText("Truk aktif");

    await page.mouse.click(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.8,
      (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.8,
    );
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
    await page.getByTestId("child-stage").click({ position: { x: 820, y: 500 } });
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
    await page.keyboard.press("ArrowRight");
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

    for (let beat = 0; beat < 3; beat += 1) {
      await Promise.all(Array.from({ length: 12 }, () => page.keyboard.press("ArrowRight")));
    }
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

  test("completes the train Vehicle Journey with keyboard input", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("game-status")).toHaveText("Truk kembali ke garasi");
    await expect(page.getByTestId("game-status")).toHaveText("Truk tenang di garasi", {
      timeout: 3_000,
    });

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("active-vehicle")).toHaveText("Kereta aktif");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta sedang berjalan");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta di stasiun", {
      timeout: 3_000,
    });

    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta kembali ke depot");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta tenang di depot", {
      timeout: 3_000,
    });
  });

  test("selects the train from its Resting Place with a pointer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();

    await page.mouse.click(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.82,
      (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.45,
    );

    await expect(page.getByTestId("active-vehicle")).toHaveText("Kereta aktif");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta sedang berjalan");
  });

  test("keeps rapid train input on one journey and gently recovers a carriage", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("game-status")).toHaveText("Truk tenang di garasi", {
      timeout: 3_000,
    });
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta di stasiun", {
      timeout: 3_000,
    });

    await Promise.all(
      Array.from({ length: 16 }, (_, index) => page.keyboard.press(index % 2 ? "Space" : "Enter")),
    );
    await expect(page.getByTestId("game-status")).toHaveText("Kereta kembali ke depot");
    await expect(page.getByTestId("active-vehicle")).toHaveText("Kereta aktif");

    await expect(page.getByTestId("game-status")).toHaveText("Kereta tenang di depot", {
      timeout: 3_000,
    });
    expect(pageErrors).toEqual([]);
  });

  test("gently recovers a train carriage moved to an unreachable edge", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("game-status")).toHaveText("Truk tenang di garasi", {
      timeout: 3_000,
    });
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta di stasiun", {
      timeout: 3_000,
    });

    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const train = {
      x: (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.53,
      y: (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.45,
    };
    await page.mouse.move(train.x, train.y);
    await page.mouse.down();
    await page.mouse.move((bounds?.x ?? 0) + 4, (bounds?.y ?? 0) + 4, { steps: 8 });

    await expect(page.getByTestId("game-status")).toHaveText("Kereta kembali perlahan", {
      timeout: 3_000,
    });
    await page.mouse.up();
    await expect(page.getByTestId("game-status")).toHaveText("Kereta di stasiun", {
      timeout: 3_000,
    });
  });

  test("shows calm feedback when a grabbed carriage sways against its constraint", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
      timeout: 3_000,
    });
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("game-status")).toHaveText("Truk tenang di garasi", {
      timeout: 3_000,
    });
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("game-status")).toHaveText("Kereta di stasiun", {
      timeout: 3_000,
    });

    const canvas = page.locator("canvas");
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const carriage = {
      x: (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.35,
      y: (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.45,
    };
    await page.mouse.move(carriage.x, carriage.y);
    await page.mouse.down();
    await expect(page.getByTestId("game-status")).toHaveText("Kereta bergerak perlahan");
    await page.mouse.move(carriage.x + (bounds?.width ?? 0) * 0.12, carriage.y + 60, {
      steps: 12,
    });

    await expect(page.getByTestId("game-status")).toHaveText("Gerbong bergoyang lembut", {
      timeout: 3_000,
    });
    await page.mouse.up();
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
    await page.keyboard.press("ArrowUp");
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

    for (let beat = 0; beat < 3; beat += 1) {
      await Promise.all(
        Array.from({ length: 20 }, (_, index) => page.keyboard.press(index % 2 ? "ArrowDown" : "ArrowUp")),
      );
    }

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
    await page.clock.install();
    await page.clock.runFor(2_000);

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

  test("shows calm feedback when the airplane reaches a safe-corridor bound", async ({ page }) => {
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
    await page.clock.install();
    await page.clock.runFor(2_000);

    const airplane = {
      x: (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.5,
      y: (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.35,
    };
    await page.mouse.move(airplane.x, airplane.y);
    await page.mouse.down();
    await expect(page.getByTestId("game-status")).toHaveText("Pesawat bergerak perlahan");
    await page.mouse.move(
      (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.1,
      airplane.y,
      { steps: 12 },
    );

    await expect(page.getByTestId("game-status")).toHaveText("Pesawat tetap di koridor aman", {
      timeout: 3_000,
    });
    await page.mouse.up();
  });

  test.describe("touchscreen guidance", () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });

    test("keeps the Child Stage active while offering calm portrait guidance", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

      await expect(page.getByTestId("child-stage")).toBeVisible();
      await expect(page.getByTestId("portrait-guidance")).toBeVisible();
      await expect(page.getByTestId("portrait-guidance")).toContainText("landscape");
      await expect(page.getByTestId("child-stage")).toHaveCSS("touch-action", "none");
      await expect(page.getByTestId("playroom")).toHaveCSS("touch-action", "auto");
      await expect(page.locator("canvas")).toBeVisible();
      await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");

      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.getByTestId("portrait-guidance")).toBeHidden();
      await expect(page.getByTestId("child-stage")).toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(1);
    });

    test("maps a one-finger tap to the journey and suppresses a second active touch", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

      const canvas = page.locator("canvas");
      const bounds = await canvas.boundingBox();
      expect(bounds).not.toBeNull();
      await page.touchscreen.tap(
        (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.9,
        (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.8,
      );
      await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");

      const point = {
        x: (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.9,
        y: (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.8,
      };
      await dispatchTouch(page, "touchstart", 51, point);
      await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
        timeout: 3_000,
      });

      await dispatchTouch(page, "touchstart", 52, point);
      await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan");

      await dispatchTouch(page, "touchend", 51, point);
      await dispatchTouch(page, "touchend", 52, point);
    });
  });

  test.describe("touch resting-place selection", () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 844, height: 390 },
    });

    test("selects a visible airplane Resting Place with a touch", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

      const canvas = page.locator("canvas");
      const bounds = await canvas.boundingBox();
      expect(bounds).not.toBeNull();
      await page.touchscreen.tap(
        (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.94,
        (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.72,
      );

      await expect(page.getByTestId("game-status")).toHaveText("Pesawat terbang di koridor aman", {
        timeout: 3_000,
      });
      await expect(page.getByTestId("active-vehicle")).toHaveText("Pesawat aktif");
    });
  });

  test.describe("responsive viewports", () => {
    test.describe("laptop 16:9", () => {
      test.use({ viewport: { width: 1366, height: 768 } });

      test("keeps the Playroom controls and Child Stage targets visible", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("button", { name: "Mulai Depot Tenang" })).toBeVisible();
        await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

        await expect(page.locator("canvas")).toBeVisible();
        const bounds = await page.locator("canvas").boundingBox();
        expect(bounds?.width).toBeGreaterThan(900);
        expect(bounds?.height).toBeGreaterThan(500);
        await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
      });
    });

    test.describe("laptop 16:10", () => {
      test.use({ viewport: { width: 1280, height: 800 } });

      test("retains the full Diorama without hiding the Child Stage", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

        await expect(page.getByTestId("child-stage")).toBeVisible();
        await expect(page.locator("canvas")).toBeVisible();
        await expect(page.getByTestId("game-status")).toHaveText("Truk menunggu di garasi");
        await expect(page.getByTestId("stage-title")).toBeVisible();
      });
    });

    test.describe("ultrawide", () => {
      test.use({ viewport: { width: 1920, height: 1080 } });

      test("keeps the interactive stage inside the viewport", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

        const bounds = await page.locator("canvas").boundingBox();
        expect(bounds?.x).toBeGreaterThanOrEqual(0);
        expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(1920);
        expect(bounds?.y).toBeGreaterThanOrEqual(0);
        expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(1080);
      });
    });

    test.describe("mobile landscape", () => {
      test.use({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 844, height: 390 },
      });

      test("completes a Play Cycle through one-finger Equivalent Input", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();
        await expect(page.getByTestId("portrait-guidance")).toBeHidden();

        const canvas = page.locator("canvas");
        const bounds = await canvas.boundingBox();
        expect(bounds).not.toBeNull();
        const playPoint = {
          x: (bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.85,
          y: (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.8,
        };

        await page.touchscreen.tap(playPoint.x, playPoint.y);
        await expect(page.getByTestId("game-status")).toHaveText("Truk sedang berjalan");
        await expect(page.getByTestId("game-status")).toHaveText("Truk menurunkan muatan", {
          timeout: 3_000,
        });

        await page.touchscreen.tap(playPoint.x, playPoint.y);
        await page.touchscreen.tap(playPoint.x, playPoint.y);
        await page.touchscreen.tap(playPoint.x, playPoint.y);
        await expect(page.getByTestId("game-status")).toHaveText("Truk kembali ke garasi");
        await expect(page.getByTestId("game-status")).toHaveText("Truk tenang di garasi", {
          timeout: 3_000,
        });
      });
    });
  });
});

async function dispatchTouch(
  page: import("@playwright/test").Page,
  type: "touchstart" | "touchend",
  identifier: number,
  point: { x: number; y: number },
): Promise<void> {
  await page.evaluate(
    ({ type, identifier, point }) => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      if (!canvas) {
        throw new Error("Missing game canvas");
      }

      const touch = new Touch({
        identifier,
        target: canvas,
        clientX: point.x,
        clientY: point.y,
        pageX: point.x,
        pageY: point.y,
        screenX: point.x,
        screenY: point.y,
      });
      const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === "touchend" ? [] : [touch],
        targetTouches: type === "touchend" ? [] : [touch],
        changedTouches: [touch],
      });
      canvas.dispatchEvent(event);
    },
    { type, identifier, point },
  );
}
