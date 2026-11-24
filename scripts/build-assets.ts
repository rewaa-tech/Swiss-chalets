// Generates WebP variants (480/960/1600) of the default hero photos into public/img/hero.
import sharp from "sharp";
import { mkdirSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

const src = "design/photos", dst = "public/img/hero";
mkdirSync(dst, { recursive: true });
for (const f of readdirSync(src).filter((f) => /\.(jpe?g|png)$/i.test(f))) {
  const name = basename(f, extname(f));
  for (const w of [480, 960, 1600]) {
    await sharp(join(src, f)).resize({ width: w, withoutEnlargement: false }).webp({ quality: w === 480 ? 70 : 78 }).toFile(join(dst, `${name}-${w}.webp`));
  }
  const meta = await sharp(join(src, f)).metadata();
  console.log(name, meta.width, meta.height);
}
