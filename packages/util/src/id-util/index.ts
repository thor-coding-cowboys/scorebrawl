import { ulid } from "ulid";

export const createUlid = (): string => {
	return ulid();
};

const prefixes = {
	match: "mtch",
	season: "sson",
	player: "plr",
	team: "team",
	matchPlayer: "mp",
	seasonPlayer: "sp",
	leaguePlayer: "lp",
	fixture: "fxtr",
	leagueTeam: "orgt",
} as const;

export const newId = (prefix: keyof typeof prefixes): string => {
	return [prefixes[prefix], ulid()].join("_");
};

/**
 * Validates if a string is a valid prefixed ID
 * Format: {prefix}_{ulid}
 */
export const isValidId = (id: string, expectedPrefix?: keyof typeof prefixes): boolean => {
	if (!id || typeof id !== "string") return false;

	const parts = id.split("_");
	if (parts.length !== 2) return false;

	const [prefix, idPart] = parts;

	// Check if prefix is valid
	if (!Object.values(prefixes).includes(prefix as (typeof prefixes)[keyof typeof prefixes])) {
		return false;
	}

	// If expected prefix provided, check it matches
	if (expectedPrefix && prefix !== prefixes[expectedPrefix]) {
		return false;
	}

	// Validate ULID format (26 chars, base32)
	const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i;
	return ulidRegex.test(idPart);
};

/**
 * Extracts the prefix from a valid ID
 */
export const getIdPrefix = (id: string): string | null => {
	if (!isValidId(id)) return null;
	return id.split("_")[0] || null;
};

/**
 * Validates that an ID has the expected prefix
 */
export const hasPrefix = (id: string, prefix: keyof typeof prefixes): boolean => {
	return isValidId(id) && id.startsWith(`${prefixes[prefix]}_`);
};

/**
 * Creates a Zod schema for validating IDs of a specific type
 */
export const createIdSchema = (prefix: keyof typeof prefixes) => {
	return z
		.string()
		.refine(
			(val) => isValidId(val, prefix),
			`Invalid ID format. Expected: ${prefixes[prefix]}_{ulid}`
		);
};

/**
 * Creates a Zod schema for optional IDs of a specific type
 */
export const createOptionalIdSchema = (prefix: keyof typeof prefixes) => {
	return z
		.string()
		.optional()
		.refine((val) => {
			if (val === undefined) return true;
			return isValidId(val, prefix);
		}, `Invalid ID format. Expected: ${prefixes[prefix]}_{ulid}`);
};

import { z } from "zod";
export { ulid };
export { prefixes };
export type Prefix = keyof typeof prefixes;
