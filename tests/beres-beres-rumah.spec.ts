import { expect, test } from "@playwright/test";

test("Beres-Beres Rumah supports keyboard matching, gentle hints, pause, and replay", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai Beres-Beres Rumah" }).click();
  const board = page.locator(".beres-board");
  const items = board.locator(".beres-item");
  const destinations = board.locator(".beres-destination");
  await expect(board).toBeVisible();
  await expect(items).toHaveCount(3);
  await expect(destinations).toHaveCount(3);

  await page.keyboard.press("ArrowRight");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(items.first()).toHaveAttribute("aria-pressed", "true");
  await board.getByRole("button", { name: "Nampan makanan" }).click();
  await board.getByRole("button", { name: "Nampan makanan" }).click();
  await expect(board.getByRole("button", { name: "Kotak mainan" })).toHaveClass(/beres-destination--hint/);
  await expect(items.first()).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.down("Shift");
  await page.keyboard.down("Enter");
  await expect(page.getByTestId("companion-gate")).toBeVisible();
  await page.keyboard.up("Enter");
  await page.keyboard.up("Shift");
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-place="mainan"]')!.click());
  await expect(items).toHaveCount(3);
  await page.getByRole("button", { name: "Continue" }).click();

  await board.getByRole("button", { name: "Kotak mainan" }).click();
  await board.getByRole("button", { name: "Apel" }).click();
  await board.getByRole("button", { name: "Nampan makanan" }).click();
  await board.getByRole("button", { name: "Kaus" }).click();
  await board.getByRole("button", { name: "Keranjang cucian" }).click();
  await expect(board.getByText("Rumah sudah rapi!", { exact: true })).toBeVisible();
  await expect(board.getByText(/rapikan satu benda sungguhan/)).toBeVisible();
  await board.getByRole("button", { name: "Main lagi" }).click();
  await expect(board).toHaveAttribute("data-round", "2");
  await expect(items).toHaveCount(3);
});

test("all 25 everyday objects appear across repeatable rounds", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mulai Beres-Beres Rumah" }).click();
  const board = page.locator(".beres-board");
  await expect(board).toBeVisible();
  const seen = new Set<string>();
  const placeFor: Record<string, string> = {
    mobil: "mainan", boneka: "mainan", bola: "mainan", robot: "mainan", balok: "mainan",
    apel: "makanan", pisang: "makanan", jeruk: "makanan", pir: "makanan", roti: "makanan",
    kaus: "pakaian", celana: "pakaian", "kaus-kaki": "pakaian", jaket: "pakaian", rok: "pakaian",
    krayon: "gambar", "pensil-warna": "gambar", kertas: "gambar", kuas: "gambar", palet: "gambar",
    "sepatu-olahraga": "alas-kaki", "sepatu-sekolah": "alas-kaki", "sandal-jepit": "alas-kaki",
    "sandal-bertali": "alas-kaki", "sepatu-bot": "alas-kaki",
  };
  for (let round = 0; round < 9; round++) {
    const names = await board.locator(".beres-item").evaluateAll(buttons =>
      buttons.map(button => (button as HTMLElement).dataset.item!));
    for (const name of names) {
      seen.add(name);
      await board.locator('[data-item="' + name + '"]').click();
      await board.locator('[data-place="' + placeFor[name] + '"]').click();
    }
    await expect(board.getByRole("button", { name: "Main lagi" })).toBeVisible();
    if (round < 8) await board.getByRole("button", { name: "Main lagi" }).click();
  }
  expect([...seen].sort()).toEqual(Object.keys(placeFor).sort());
});

test("phone dragging, mute, reduced motion, and offline replay work", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByTestId("reduced-motion-toggle").check();
  await page.getByRole("radio", { name: "Senyap" }).check();
  await page.getByRole("button", { name: "Mulai Beres-Beres Rumah" }).click();
  const board = page.locator(".beres-board");
  await expect(board).toHaveAttribute("data-reduced-motion", "true");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-sound-profile", "senyap");
  const item = (await board.getByRole("button", { name: "Mobil" }).boundingBox())!;
  const destination = (await board.getByRole("button", { name: "Kotak mainan" }).boundingBox())!;
  await page.mouse.move(item.x + item.width / 2, item.y + item.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(board.locator(".beres-item")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Mulai Beres-Beres Rumah" }).click();
  await expect(board).toBeVisible();
  await expect(board.locator(".beres-item img")).toHaveCount(3);
  await expect.poll(() => board.locator("img").evaluateAll(images =>
    images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)))
    .toBe(true);
});
