import { expect, test } from "@playwright/test";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const publicAssets = join(process.cwd(), "public", "assets");

test("Playroom thumbnails stay below 500 KB combined", async ({ page }) => {
  await page.goto("/");
  const displayedSources = await page.locator(".game-card img, .activity-picker img")
    .evaluateAll(images => images.map(image => (image as HTMLImageElement).src));
  expect(displayedSources).toHaveLength(6);
  expect(displayedSources.every(source => source.endsWith(".webp"))).toBe(true);
  const previews = [
    "train-locomotive-sol.webp",
    "truck-mixer-body.webp",
    "truck-mining-dump-body.webp",
    "airplane-body.webp",
  ];
  const bytes = await Promise.all(previews.map(async name =>
    (await stat(join(publicAssets, "depot-tenang-v2", name))).size,
  ));
  expect(bytes.reduce((sum, size) => sum + size, 0)).toBeLessThan(500_000);
});

test("Depot 3D models stay below 1 MB combined", async () => {
  const models = join(publicAssets, "depot-tenang-3d");
  const names = (await readdir(models)).filter(name => name.endsWith(".glb"));
  expect(names).toHaveLength(22);
  const bytes = await Promise.all(names.map(async name => (await stat(join(models, name))).size));
  expect(bytes.reduce((sum, size) => sum + size, 0)).toBeLessThan(1_000_000);
  for (const name of names) {
    const glb = await readFile(join(models, name));
    expect(glb.toString("utf8", 0, 4)).toBe("glTF");
    const jsonLength = glb.readUInt32LE(12);
    const gltf = JSON.parse(glb.toString("utf8", 20, 20 + jsonLength)) as {
      extensionsRequired?: string[];
    };
    expect(gltf.extensionsRequired, name).toContain("EXT_meshopt_compression");
  }
});
