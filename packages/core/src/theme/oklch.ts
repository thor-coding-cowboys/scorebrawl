const OKLCH_RE =
	/^oklch\(\s*([+-]?[\d.]+)(%?)\s+([+-]?[\d.]+)(%?)\s+([+-]?[\d.]+)(deg|rad|turn)?\s*(?:\/\s*([+-]?[\d.]+)(%?)\s*)?\)$/;

const CUBE_ROOTS: Array<[number, number, number]> = [
	[0.3963377774, 0.2158037573, 0],
	[-0.1055613458, -0.0638541728, 0],
	[-0.0894841775, -1.291485548, 0],
];

const SRGB = [
	[4.0767416621, -3.3077115913, 0.2309699292],
	[-1.2684380046, 2.6097574011, -0.3413193965],
	[-0.0041960863, -0.7034186147, 1.707614701],
];

function gammaEncode(channel: number): number {
	const clamped = Math.min(1, Math.max(0, channel));
	const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
	return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
}

function hueToDegrees(value: number, unit: string | undefined): number {
	if (unit === "rad") return (value * 180) / Math.PI;
	if (unit === "turn") return value * 360;
	return value;
}

function formatAlpha(alpha: number): string {
	return String(Number((alpha * 100).toFixed(4)));
}

/**
 * Converts a CSS `oklch()` string to `#rrggbb` / `#rrggbbaa`.
 * Returns null when the input cannot be parsed.
 */
export function oklchToHex(value: string): string | null {
	const match = OKLCH_RE.exec(value.trim());
	if (!match) return null;

	const [, light, lightPercent, chroma, chromaPercent, hue, hueUnit, alpha, alphaPercent] = match;
	const L = Number.parseFloat(light as string) * (lightPercent ? 0.01 : 1);
	const C = Number.parseFloat(chroma as string) * (chromaPercent ? 0.004 : 1);
	const H = hueToDegrees(Number.parseFloat(hue as string), hueUnit);
	if ([L, C, H].some((n) => Number.isNaN(n))) return null;

	const a = C * Math.cos((H * Math.PI) / 180);
	const b = C * Math.sin((H * Math.PI) / 180);
	const [l, m, s] = CUBE_ROOTS.map(([al, bl, cl]) => (L + al * a + bl * b + cl) ** 3) as [
		number,
		number,
		number,
	];
	const [r, g, blue] = SRGB.map(([ar, br, cr]) => ar * l + br * m + cr * s) as [
		number,
		number,
		number,
	];

	const rgb = [r, g, blue].map(gammaEncode);
	const channelHex = rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("");

	const alphaValue =
		alpha === undefined
			? 1
			: Math.min(1, Math.max(0, Number.parseFloat(alpha) * (alphaPercent ? 0.01 : 1)));
	if (Number.isNaN(alphaValue)) return null;
	if (alphaValue >= 1) return `#${channelHex}`;

	return `#${channelHex}${Math.round(alphaValue * 255)
		.toString(16)
		.padStart(2, "0")}`;
}

/** Returns `value` with its alpha replaced by `alpha` (0–1). */
export function withAlpha(value: string, alpha: number): string {
	const base = value
		.replace(/\s*\/[^)]*\)\s*$/, ")")
		.replace(/\)\s*$/, "")
		.trim();
	return `${base} / ${formatAlpha(alpha)}%)`;
}
