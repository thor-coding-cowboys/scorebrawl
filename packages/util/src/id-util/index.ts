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
} as const;

export const newId = (prefix: keyof typeof prefixes): string => {
	return [prefixes[prefix], ulid()].join("_");
};

export { ulid };
export { prefixes };
export type Prefix = keyof typeof prefixes;
