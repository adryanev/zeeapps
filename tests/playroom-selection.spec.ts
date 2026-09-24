import { expect, test } from "@playwright/test";

test("the Playroom selects a playable Game and keeps Companion settings outside its card", async ({page}) => {
  await page.goto("/");

  const list = page.getByTestId("game-list");
  await expect(list.getByRole("listitem")).toHaveCount(1);
  const card = page.getByTestId("game-card-depot-tenang");
  await expect(card.getByRole("heading", {name:"Depot Tenang"})).toBeVisible();
  await expect(card.locator(".game-card__asset")).toHaveCount(3);
  await expect(card.getByTestId("companion-settings")).toHaveCount(0);
  await expect(page.getByTestId("companion-settings")).toBeVisible();

  await card.getByRole("button", {name:"Mulai Depot Tenang"}).click();
  await expect(page.getByTestId("child-stage")).toBeVisible();
  await expect(page.getByTestId("playroom")).toBeHidden();
});

test("a small phone shows the full Game launch button without horizontal scrolling", async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await page.goto("/");

  const button = (await page.getByRole("button", {name:"Mulai Depot Tenang"}).boundingBox())!;
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.y + button.height).toBeLessThanOrEqual(568);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
