/**
 * Renders assets/og-image.svg to public/og-image.png (the og:image / twitter:image
 * card used for link previews).
 *
 * librsvg refuses to load external files, so the brand mark is inlined as a data
 * URI before rendering. Requires `rsvg-convert` (`brew install librsvg`).
 */
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const webDir = new URL("../", import.meta.url).pathname;
const svgPath = join(webDir, "assets/og-image.svg");
const outPath = join(webDir, "public/og-image.png");

const logo = await readFile(join(webDir, "public/landing/scorebrawl-logo.png"));
const svg = (await readFile(svgPath, "utf8")).replace(
	/href="[^"]*scorebrawl-logo\.png"/,
	`href="data:image/png;base64,${logo.toString("base64")}"`
);

const inlinedPath = join(tmpdir(), "scorebrawl-og-image.svg");
await writeFile(inlinedPath, svg);

const rsvg = spawnSync("rsvg-convert", ["-w", "1200", "-h", "630", inlinedPath, "-o", outPath], {
	stdio: "inherit",
});

if (rsvg.error) {
	throw new Error("rsvg-convert not found. Install it with `brew install librsvg`.");
}

if (rsvg.status !== 0) {
	process.exit(rsvg.status ?? 1);
}

console.log(`Wrote ${outPath}`);
