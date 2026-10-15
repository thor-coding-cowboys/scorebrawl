import { oklchToHex } from "./oklch";
import type { ThemeMode } from "./tokens";
import { themes } from "./tokens";

/** Number of distinct avatar tones; also the modulus for name selection. */
export const AVATAR_TONE_COUNT = themes.light.avatar.length;

/**
 * Stable name → tone index, matching the ordering authored in `tokens.ts`.
 * Returns `-1` when there is no name to hash, so callers can pick a fallback.
 */
export function selectAvatarIndex(name: string): number {
	const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
	if (normalized.length === 0) return -1;

	let hash = 0;
	for (let i = 0; i < normalized.length; i++) {
		hash = (hash << 5) - hash + normalized.charCodeAt(i);
		hash &= hash;
	}

	return Math.abs(hash) % AVATAR_TONE_COUNT;
}

export type AvatarToneHex = { background: string; text: string; border: string };

/** Avatar tones as hex (React Native cannot parse oklch). */
export function avatarTones(mode: ThemeMode): AvatarToneHex[] {
	return themes[mode].avatar.map((tone) => {
		const background = oklchToHex(tone.background);
		const text = oklchToHex(tone.text);
		const border = oklchToHex(tone.border);
		if (!background || !text || !border) {
			throw new Error(`Avatar tone is not convertible to hex: ${tone.text}`);
		}
		return { background, text, border };
	});
}
