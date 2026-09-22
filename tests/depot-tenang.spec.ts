import { expect, test, type Page } from "@playwright/test";
import { startFreePlay } from "./freePlayHelpers";

async function touchWorld(page: Page, x: number, y: number): Promise<void> {
  const bounds = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(bounds.x + x * bounds.width / 960, bounds.y + y * bounds.height / 540);
}
async function loadRocks(page: Page): Promise<void> {
  for (const x of [535, 601, 667]) await touchWorld(page, x, 192);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load", "3");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.rocks.filter((r: any) => r.state === "bed").length)).toBe(3);
}
async function goToPit(page: Page): Promise<void> {
  await touchWorld(page, 310, 340);
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.truckX), {timeout: 6000}).toBeLessThan(415);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-vehicle-state", "ready");
}

test("opens the tactile playground with large objects and no driving toolbar", async ({page}) => {
  await startFreePlay(page);
  await expect(page.getByTestId("game-status")).toHaveText("Sentuh batu di rel");
  await expect(page.locator("[data-control]")).toHaveCount(0);
  await expect(page.locator(".activity-picker button")).toHaveCount(3);
  expect(await page.evaluate(() => (window as any).__fleetScene.truck.visual.scaleX)).toBeGreaterThan(1.5);
});

test("clearing the actual rocks opens the railway, then tipping releases physical cargo", async ({page}) => {
  await startFreePlay(page);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__fleetScene.trainBodies[0].position.x)).toBeCloseTo(390, 0);
  await touchWorld(page, 535, 192);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-remaining", "2");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__fleetScene.trainBodies[0].position.x)).toBeCloseTo(390, 0);
  for (const x of [601, 667]) await touchWorld(page, x, 192);
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.trainBodies[0].position.x)).toBeGreaterThan(440);
  await goToPit(page);
  await touchWorld(page, 343, 280);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered", "3");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load", "0");
  const cargo = await page.evaluate(() => (window as any).__fleetScene.rocks.map((r: any) => ({state:r.state, isStatic:r.image.body.isStatic, mask:r.image.body.collisionFilter.mask})));
  expect(cargo.every((r: any) => r.state === "falling" && !r.isStatic && r.mask === 6)).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.blocks.some((b: any) => Math.abs(b.rotation) > 0.15))).toBe(true);
});

test("bed dragging controls release and cancellation stops the active gesture", async ({page}) => {
  await startFreePlay(page);
  await loadRocks(page);
  await goToPit(page);
  const b = (await page.locator("canvas").boundingBox())!;
  const move = (x: number,y: number) => page.mouse.move(b.x+x*b.width/960,b.y+y*b.height/540,{steps:8});
  await move(343,280);
  await page.mouse.down();
  await move(343,260);
  await page.waitForTimeout(400);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered","0");
  await move(343,165);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered","3");
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__fleetScene.activePointer)).toBeUndefined();
});

test("the supply box restarts rock play while preserving the pile", async ({page}) => {
  await startFreePlay(page);
  await loadRocks(page);
  await goToPit(page);
  await touchWorld(page,343,280);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered","3");
  await touchWorld(page,861,403);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-remaining","3",{timeout:12000});
  expect(await page.evaluate(() => (window as any).__fleetScene.rocks.filter((r:any)=>r.state==="falling").length)).toBe(3);
  await expect(page.getByTestId("child-stage")).not.toHaveAttribute("data-quiet-state");
});

test("rapid mold touches fill all three bridge pieces and a truck crosses", async ({page}) => {
  await startFreePlay(page);
  await page.getByRole("button",{name:"Bangun jembatan",exact:true}).click();
  for(const x of [154,249,344]) await touchWorld(page,x,376);
  // Re-selecting the current activity must not cancel queued pours.
  await page.getByRole("button",{name:"Bangun jembatan",exact:true}).click();
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-bridge","3",{timeout:12000});
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.cargoX)).toBeGreaterThan(110);
  await page.getByRole("button",{name:"Cuci pesawat",exact:true}).click();
  await page.getByRole("button",{name:"Bangun jembatan",exact:true}).click();
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-bridge","3");
  await touchWorld(page,861,403);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-bridge","0");
});

test("washing removes visible dirt and the clean plane flies, then can get dirty again", async ({page}) => {
  await startFreePlay(page);
  await page.getByRole("button",{name:"Cuci pesawat",exact:true}).click();
  await touchWorld(page,217,334);
  expect(await page.evaluate(() => {
    const s=(window as any).__fleetScene;
    return s.sprayTime > 0 && s.washTarget !== undefined && s.activePointer === undefined;
  })).toBe(true);
  for(const [x,y] of [[258,345],[310,334],[352,338],[285,368]]) await touchWorld(page,x,y);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-dirty","0");
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.airplane.visual.y)).toBeLessThan(270);
  await touchWorld(page,861,403);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-dirty","5");
  expect(await page.evaluate(()=>(window as any).__fleetScene.flight)).toBe(0);
});

test("keyboard can complete the rock activity without precise pointer movement", async ({page}) => {
  await startFreePlay(page);
  for(let i=0;i<3;i++) await page.keyboard.press("Space");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load","3");
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__fleetScene.truckX), {timeout:6000}).toBeLessThan(415);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-vehicle-state","ready",{timeout:6000});
  await page.keyboard.press("Space");
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-delivered","3");
});

test("Companion Gate freezes the automatic train and pending cargo motion", async ({page}) => {
  await startFreePlay(page);
  await loadRocks(page);
  await page.keyboard.down("Shift");
  await page.keyboard.down("Enter");
  await expect(page.getByTestId("companion-gate")).toBeVisible();
  await page.keyboard.up("Enter");
  await page.keyboard.up("Shift");
  const before=await page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x);
  await page.waitForTimeout(350);
  expect(await page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeCloseTo(before,3);
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeGreaterThan(before+15);
});

for(const viewport of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]) {
  test(`playground and activity choices fit ${viewport.width} by ${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);
    await startFreePlay(page);
    const canvas=(await page.locator("canvas").boundingBox())!;
    expect(canvas.width/canvas.height).toBeCloseTo(16/9,2);
    for(const selector of ["canvas",".activity-picker"]) {
      const b=(await page.locator(selector).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y+b.height).toBeLessThanOrEqual(viewport.height+1);
      expect(b.x+b.width).toBeLessThanOrEqual(viewport.width+1);
    }
  });
}

test.describe("touch",()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
  test("one-finger taps load rocks and wash the airplane",async({page})=>{
    await startFreePlay(page);
    let b=(await page.locator("canvas").boundingBox())!;
    await page.touchscreen.tap(b.x+535*b.width/960,b.y+190*b.height/540);
    await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load","1");
    await page.getByRole("button",{name:"Cuci pesawat",exact:true}).tap();
    b=(await page.locator("canvas").boundingBox())!;
    await page.touchscreen.tap(b.x+217*b.width/960,b.y+334*b.height/540);
    await expect.poll(()=>page.getByTestId("child-stage").getAttribute("data-dirty")).not.toBe("5");
  });
});
