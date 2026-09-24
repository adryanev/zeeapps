import { resolve } from "node:path";
import sharp from "sharp";

const directory = resolve("public/assets/depot-tenang-v2");
const previews = [
  "train-locomotive-sol",
  "truck-mixer-body",
  "truck-mining-dump-body",
  "airplane-body",
];

for (const name of previews) {
  const source = resolve(directory, `${name}.png`);
  const target = resolve(directory, `${name}.webp`);
  await sharp(source)
    .resize({ width: 768, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6, alphaQuality: 90 })
    .toFile(target);
}

console.log(`Optimized ${previews.length} Playroom thumbnails`);
