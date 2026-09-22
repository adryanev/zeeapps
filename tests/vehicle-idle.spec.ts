import { expect, test } from "@playwright/test";
import { startFreePlay } from "./freePlayHelpers";

test("a train that has rested still moves when the last rock is cleared", async ({ page }) => {
  await startFreePlay(page);
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => (window as any).__fleetScene.trainBodies[0].position.x);
  for (let i = 0; i < 3; i++) await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.trainBodies[0].position.x), {timeout:3000}).toBeGreaterThan(before + 50);
});

test("settled rocks wake when dragged and can be loaded again", async ({ page }) => {
  await startFreePlay(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.truckX), {timeout:6000}).toBeLessThan(415);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-vehicle-state", "ready");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered", "3");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.rocks.every((r:any)=>r.image.body.isSleeping)), {timeout:10000}).toBe(true);
  const point = await page.evaluate(() => {
    const rocks = (window as any).__fleetScene.rocks.map((r:any)=>({x:r.image.x,y:r.image.y}));
    return rocks.sort((a:any,b:any)=>a.y-b.y)[0];
  });
  const b = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(b.x+point.x*b.width/960,b.y+point.y*b.height/540);
  await page.mouse.down();
  await page.mouse.move(b.x+(point.x+30)*b.width/960,b.y+(point.y-100)*b.height/540,{steps:10});
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.grabbed?.image.y)).toBeLessThan(point.y-50);
  await page.mouse.move(b.x+410*b.width/960,b.y+300*b.height/540,{steps:10});
  await page.mouse.up();
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load","1");
});

test("falling rocks resume gravity after returning to their activity", async ({ page }) => {
  await startFreePlay(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.truckX), {timeout:6000}).toBeLessThan(415);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-vehicle-state", "ready");
  await page.keyboard.press("Space");
  // Observe each rendered frame: the first-rock window is shorter than expect's retry interval.
  await page.waitForFunction(() => document.querySelector<HTMLElement>("[data-testid='child-stage']")?.dataset.delivered === "1");
  await page.getByRole("button", {name:"Cuci pesawat",exact:true}).click();
  const y=await page.evaluate(()=>(window as any).__fleetScene.rocks.find((r:any)=>r.state==="falling").image.y);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>(window as any).__fleetScene.rocks.find((r:any)=>r.state==="falling").image.y)).toBeCloseTo(y,1);
  await page.getByRole("button", {name:"Bermain batu dan kereta",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.rocks.find((r:any)=>r.state==="falling").image.y)).toBeGreaterThan(y+15);
});
