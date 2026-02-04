import {
	and,
	asc,
	desc,
	eq,
	getTableColumns,
	gt,
	gte,
	isNull,
	lt,
	lte,
	or,
	sql,
} from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { league as organization } from "../db/schema/auth-schema";
import {
	season,
	seasonPlayer,
	fixture,
	orgTeam,
	player,
	type scoreType,
	match,
} from "../db/schema/competition-schema";
import { slugifyWithCustomReplacement } from "./slug";

export interface SeasonCreateInput {
	name: string;
	initialScore: number;
	scoreType: (typeof scoreType)[number];
	kFactor: number;
	startDate: Date;
	endDate?: Date;
	rounds?: number;
	organizationId: string;
	userId: string;
}

export interface SeasonEditInput {
	seasonId: string;
	name?: string;
	startDate?: Date;
	endDate?: Date;
	initialScore?: number;
	scoreType?: (typeof scoreType)[number];
	kFactor?: number;
	userId: string;
}

export const findOverlappingSeason = async ({
	db,
	organizationId,
	startDate,
	endDate,
}: {
	db: DrizzleDB;
	organizationId: string;
	startDate: Date;
	endDate?: Date;
}) => {
	const [comp] = await db
		.select()
		.from(season)
		.where(
			and(
				eq(season.organizationId, organizationId),
				lte(season.startDate, endDate ?? new Date("2099-12-31")),
				or(isNull(season.endDate), gte(season.endDate, startDate))
			)
		)
		.limit(1);
	return comp;
};

export const getCountInfo = async ({ db, seasonSlug }: { db: DrizzleDB; seasonSlug: string }) => {
	const [matchCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(match)
		.innerJoin(season, eq(match.seasonId, season.id))
		.where(eq(season.slug, seasonSlug));

	const [teamCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(orgTeam)
		.innerJoin(organization, eq(orgTeam.organizationId, organization.id))
		.innerJoin(season, eq(season.organizationId, organization.id))
		.where(eq(season.slug, seasonSlug));

	const [playerCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(seasonPlayer)
		.innerJoin(season, eq(seasonPlayer.seasonId, season.id))
		.where(eq(season.slug, seasonSlug));

	return {
		matchCount: matchCount?.count || 0,
		teamCount: teamCount?.count || 0,
		playerCount: playerCount?.count || 0,
	};
};

export const getById = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	const [comp] = await db.select().from(season).where(eq(season.id, seasonId));
	if (!comp) {
		throw new Error("Season not found");
	}
	return comp;
};

export const getBySlug = async ({ db, seasonSlug }: { db: DrizzleDB; seasonSlug: string }) => {
	const [comp] = await db.select().from(season).where(eq(season.slug, seasonSlug));
	if (!comp) {
		throw new Error("Season not found");
	}
	return comp;
};

export const findActive = async ({
	db,
	organizationId,
}: {
	db: DrizzleDB;
	organizationId: string;
}) => {
	const now = new Date();
	const [comp] = await db
		.select(getTableColumns(season))
		.from(season)
		.innerJoin(organization, eq(organization.id, season.organizationId))
		.where(
			and(
				eq(season.organizationId, organizationId),
				eq(season.closed, false),
				lt(season.startDate, now),
				or(isNull(season.endDate), gt(season.endDate, now))
			)
		);
	return comp;
};

export const getAll = async ({ db, organizationId }: { db: DrizzleDB; organizationId: string }) =>
	db
		.select(getTableColumns(season))
		.from(season)
		.where(eq(season.organizationId, organizationId))
		.orderBy(desc(season.startDate));

export const update = async ({
	db,
	userId,
	seasonId,
	...rest
}: SeasonEditInput & { db: DrizzleDB }) => {
	const now = new Date();
	const [comp] = await db
		.update(season)
		.set({
			updatedAt: now,
			updatedBy: userId,
			...rest,
		})
		.where(eq(season.id, seasonId))
		.returning();
	return comp;
};

export const updateClosedStatus = async ({
	db,
	seasonId,
	userId,
	closed,
}: {
	db: DrizzleDB;
	seasonId: string;
	userId: string;
	closed: boolean;
}) => {
	const now = new Date();
	const [comp] = await db
		.update(season)
		.set({
			closed,
			updatedAt: now,
			updatedBy: userId,
		})
		.where(eq(season.id, seasonId))
		.returning();
	return comp;
};

export const create = async ({ db, ...input }: SeasonCreateInput & { db: DrizzleDB }) => {
	const slug = await slugifySeasonName({ db, name: input.name });
	const now = new Date();

	const values =
		input.scoreType === "elo"
			? {
					id: crypto.randomUUID(),
					name: input.name,
					slug,
					organizationId: input.organizationId,
					startDate: input.startDate,
					endDate: input.endDate ?? null,
					initialScore: input.initialScore,
					kFactor: input.kFactor,
					scoreType: "elo" as const,
					rounds: null,
					createdAt: now,
					updatedAt: now,
					createdBy: input.userId,
					updatedBy: input.userId,
					archived: false,
					closed: false,
				}
			: {
					id: crypto.randomUUID(),
					name: input.name,
					slug,
					organizationId: input.organizationId,
					startDate: input.startDate,
					endDate: input.endDate ?? null,
					initialScore: 0,
					kFactor: -1,
					rounds: input.rounds ?? null,
					scoreType: "3-1-0" as const,
					createdAt: now,
					updatedAt: now,
					createdBy: input.userId,
					updatedBy: input.userId,
					archived: false,
					closed: false,
				};

	const comps = await db.insert(season).values(values).returning();
	const comp = comps[0]!;

	// Get all enabled players from organization and create season players
	const players = await db
		.select({ id: player.id })
		.from(player)
		.where(and(eq(player.organizationId, input.organizationId), eq(player.disabled, false)));

	const seasonPlayerValues = players.map((p) => ({
		id: crypto.randomUUID(),
		disabled: false,
		score: comp.initialScore,
		playerId: p.id,
		seasonId: comp.id,
		createdAt: now,
		updatedAt: now,
	}));

	if (seasonPlayerValues.length > 0) {
		await db.insert(seasonPlayer).values(seasonPlayerValues);
	}

	// If 3-1-0 with rounds, generate fixtures
	if (input.scoreType === "3-1-0" && input.rounds && input.rounds > 0) {
		const seasonPlayerIds = seasonPlayerValues.map((cp) => cp.id);
		const fixturesList: (typeof fixture.$inferInsert)[] = [];

		const playersList: Array<string | null> = [...seasonPlayerIds];
		if (playersList.length % 2 !== 0) {
			playersList.push(null);
		}

		const totalPlayers = playersList.length;
		const matchesPerRound = totalPlayers / 2;
		const roundsPerCompleteTournament = totalPlayers - 1;

		for (let tournament = 0; tournament < input.rounds; tournament++) {
			let tournamentPlayers = [...playersList];

			for (let roundNum = 0; roundNum < roundsPerCompleteTournament; roundNum++) {
				const actualRound = tournament * roundsPerCompleteTournament + roundNum;
				const roundFixtures: Array<{ homeId: string | null; awayId: string | null }> = [];

				for (let i = 0; i < matchesPerRound; i++) {
					const homeId = tournamentPlayers[i];
					const awayId = tournamentPlayers[totalPlayers - 1 - i];

					if (homeId !== null && awayId !== null) {
						const finalHomeId = tournament % 2 === 0 ? homeId : awayId;
						const finalAwayId = tournament % 2 === 0 ? awayId : homeId;
						roundFixtures.push({ homeId: finalHomeId, awayId: finalAwayId });
					}
				}

				for (const f of roundFixtures) {
					fixturesList.push({
						id: crypto.randomUUID(),
						homePlayerId: f.homeId!,
						awayPlayerId: f.awayId!,
						seasonId: comp.id,
						round: actualRound + 1,
						createdAt: now,
						updatedAt: now,
						matchId: null,
						deletedAt: null,
					});
				}

				const rotatedPlayers = [
					tournamentPlayers[0],
					tournamentPlayers[totalPlayers - 1],
					...tournamentPlayers.slice(1, totalPlayers - 1),
				];
				tournamentPlayers = rotatedPlayers;
			}
		}

		if (fixturesList.length > 0) {
			await db.insert(fixture).values(fixturesList);
		}
	}

	return comp;
};

export const findFixtures = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	return db
		.select()
		.from(fixture)
		.where(eq(fixture.seasonId, seasonId))
		.orderBy(asc(fixture.round), asc(fixture.createdAt), asc(fixture.homePlayerId));
};

export const findFixtureById = async ({
	db,
	seasonId,
	fixtureId,
}: {
	db: DrizzleDB;
	seasonId: string;
	fixtureId: string;
}) => {
	const [f] = await db
		.select()
		.from(fixture)
		.where(and(eq(fixture.seasonId, seasonId), eq(fixture.id, fixtureId)))
		.limit(1);
	return f;
};

export const assignMatchToFixture = async ({
	db,
	seasonId,
	fixtureId,
	matchId,
}: {
	db: DrizzleDB;
	seasonId: string;
	fixtureId: string;
	matchId: string;
}) => {
	await db
		.update(fixture)
		.set({ matchId })
		.where(and(eq(fixture.seasonId, seasonId), eq(fixture.id, fixtureId)));
};

export const slugifySeasonName = async ({ db, name }: { db: DrizzleDB; name: string }) => {
	const rootSlug = slugifyWithCustomReplacement(name);

	const checkSlugExists = async (slug: string) => {
		const [exists] = await db.select().from(season).where(eq(season.slug, slug)).limit(1);
		return !!exists;
	};

	const findAvailableSlug = async (counter = 0): Promise<string> => {
		const checkBatchSize = 10;
		const slugsToCheck = Array.from({ length: checkBatchSize }, (_, i) => {
			const index = counter + i;
			return index === 0 ? rootSlug : `${rootSlug}-${index}`;
		});

		const checkPromises = slugsToCheck.map(async (slug) => ({
			slug,
			exists: await checkSlugExists(slug),
		}));

		const results = await Promise.all(checkPromises);
		const availableSlug = results.find((result) => !result.exists);

		if (availableSlug) {
			return availableSlug.slug;
		}

		return findAvailableSlug(counter + checkBatchSize);
	};

	return findAvailableSlug();
};
