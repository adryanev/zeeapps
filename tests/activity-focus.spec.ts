import { expect, test } from "@playwright/test";
import { startFreePlay } from "./freePlayHelpers";

test("only the selected activity's toys and scenery are visible", async ({ page }) => {
  await startFreePlay(page);
  const visible = () => page.evaluate(() => {
    const s = (window as any).__fleetScene;
    return {train:s.train.visual.visible, plane:s.airplane.visual.visible, signal:s.signal.visible,
      rocks:s.rocks.some((r:any)=>r.image.visible), blocks:s.blocks.some((b:any)=>b.visible)};
  });
  expect(await visible()).toEqual({train:true,plane:false,signal:true,rocks:true,blocks:true});
  await page.getByRole("button",{name:"Bangun jembatan",exact:true}).click();
  expect(await visible()).toEqual({train:false,plane:false,signal:false,rocks:false,blocks:false});
  await page.getByRole("button",{name:"Cuci pesawat",exact:true}).click();
  expect(await visible()).toEqual({train:false,plane:true,signal:false,rocks:false,blocks:false});
});

test("an inactive train and airplane stop until their activity returns", async ({ page }) => {
  await startFreePlay(page);
  for(let i=0;i<3;i++) await page.keyboard.press("Space");
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeGreaterThan(440);
  await page.getByRole("button",{name:"Cuci pesawat",exact:true}).click();
  const x=await page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x);
  for(let i=0;i<5;i++) await page.keyboard.press("Space");
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.flight)).toBeGreaterThan(0.1);
  expect(await page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeCloseTo(x,3);
  await page.getByRole("button",{name:"Bangun jembatan",exact:true}).click();
  const flight=await page.evaluate(()=>(window as any).__fleetScene.flight);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>(window as any).__fleetScene.flight)).toBe(flight);
  await page.getByRole("button",{name:"Bermain batu dan kereta",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeGreaterThan(x+10);
});

test("the train passes once and waits for the next supply request", async ({ page }) => {
  await startFreePlay(page);
  for(let i=0;i<3;i++) await page.keyboard.press("Space");
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeGreaterThan(440);
  // Exercise the end-of-track boundary without a wall-clock lap of the board.
  await page.evaluate(()=>{
    const s=(window as any).__fleetScene;
    const offset=1299-s.trainBodies[0].position.x;
    for(const body of s.trainBodies) s.matter.body.setPosition(body,{x:body.position.x+offset,y:body.position.y});
  });
  await expect.poll(()=>page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeGreaterThanOrEqual(1300);
  const x=await page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x);
  await page.waitForTimeout(400);
  expect(await page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeCloseTo(x,3);
  const b=(await page.locator("canvas").boundingBox())!;
  await page.mouse.click(b.x+861*b.width/960,b.y+403*b.height/540);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-remaining","3");
  expect(await page.evaluate(()=>(window as any).__fleetScene.trainBodies[0].position.x)).toBeCloseTo(390,0);
});
