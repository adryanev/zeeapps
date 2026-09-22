import { expect, test } from "@playwright/test";
import { startFreePlay } from "./freePlayHelpers";

test.use({viewport:{width:2560,height:1440}});
test("large screens render at their displayed pixel size and retain touch coordinates", async ({page})=>{
  await startFreePlay(page);
  const size=await page.locator("canvas").evaluate(canvas=>({
    pixels:(canvas as HTMLCanvasElement).width,
    displayed:canvas.getBoundingClientRect().width*window.devicePixelRatio,
  }));
  expect(size.pixels).toBeGreaterThanOrEqual(Math.floor(size.displayed));
  const b=(await page.locator("canvas").boundingBox())!;
  await page.mouse.click(b.x+535*b.width/960,b.y+192*b.height/540);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load","1");
  await page.setViewportSize({width:844,height:390});
  const small=(await page.locator("canvas").boundingBox())!;
  await page.mouse.click(small.x+601*small.width/960,small.y+192*small.height/540);
  await expect(page.getByTestId("child-stage")).toHaveAttribute("data-load","2");
});

test.describe("Retina",()=>{
  test.use({viewport:{width:1920,height:1080},deviceScaleFactor:2});
  test("uses native pixels within the 4K budget",async({page})=>{
    await startFreePlay(page);
    const sizes=await page.locator("canvas").evaluate(c=>({actual:(c as HTMLCanvasElement).width,expected:Math.min(3840,c.getBoundingClientRect().width*devicePixelRatio)}));
    expect(sizes.actual).toBeGreaterThanOrEqual(Math.floor(sizes.expected));
    expect(sizes.actual).toBeLessThanOrEqual(3840);
  });
});
