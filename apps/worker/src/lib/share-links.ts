export const SHARE_LINK_EXPIRY_PRESETS = ["1h", "24h", "7d", "30d", "never"] as const;

export type ShareLinkExpiryPreset = (typeof SHARE_LINK_EXPIRY_PRESETS)[number];

const EXPIRY_MS: Record<Exclude<ShareLinkExpiryPreset, "never">, number> = {
	"1h": 60 * 60 * 1000,
	"24h": 24 * 60 * 60 * 1000,
	"7d": 7 * 24 * 60 * 60 * 1000,
	"30d": 30 * 24 * 60 * 60 * 1000,
};

export const SHARE_LINK_KEY_PATTERN = /^[a-f0-9]{32}$/;

/** 128-bit random key, hex encoded so it is safe in a URL path. */
export function generateShareToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashShareToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function computeShareExpiry(preset: ShareLinkExpiryPreset, now = new Date()): Date | null {
	if (preset === "never") return null;
	return new Date(now.getTime() + EXPIRY_MS[preset]);
}

export function isShareExpired(expiresAt: Date | null, now = new Date()): boolean {
	return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

export function buildShareUrl(
	origin: string,
	input: { leagueId: string; seasonId: string; token: string }
) {
	return `${origin}/shared/leagues/${input.leagueId}/seasons/${input.seasonId}/standings/${input.token}`;
}
