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
import { organization } from "../db/schema/auth-schema";
import {
	competition,
	competitionPlayer,
	fixture,
	orgTeam,
	player,
	type scoreType,
	match,
} from "../db/schema/competition-schema";
import { slugifyWithCustomReplacement } from "./slug";

export interface CompetitionCreateInput {
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

export interface CompetitionEditInput {
	competitionId: string;
	name?: string;
	startDate?: Date;
	endDate?: Date;
	initialScore?: number;
	scoreType?: (typeof scoreType)[number];
	kFactor?: number;
	userId: string;
}

export const findOverlappingCompetition = async ({
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
		.from(competition)
		.where(
			and(
				eq(competition.organizationId, organizationId),
				lte(competition.startDate, endDate ?? new Date("2099-12-31")),
				or(isNull(competition.endDate), gte(competition.endDate, startDate))
			)
		)
		.limit(1);
	return comp;
};

export const getCountInfo = async ({
	db,
	competitionSlug,
}: {
	db: DrizzleDB;
	competitionSlug: string;
}) => {
	const [matchCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(match)
		.innerJoin(competition, eq(match.competitionId, competition.id))
		.where(eq(competition.slug, competitionSlug));

	const [teamCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(orgTeam)
		.innerJoin(organization, eq(orgTeam.organizationId, organization.id))
		.innerJoin(competition, eq(competition.organizationId, organization.id))
		.where(eq(competition.slug, competitionSlug));

	const [playerCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(competitionPlayer)
		.innerJoin(competition, eq(competitionPlayer.competitionId, competition.id))
		.where(eq(competition.slug, competitionSlug));

	return {
		matchCount: matchCount?.count || 0,
		teamCount: teamCount?.count || 0,
		playerCount: playerCount?.count || 0,
	};
};

export const getById = async ({ db, competitionId }: { db: DrizzleDB; competitionId: string }) => {
	const [comp] = await db.select().from(competition).where(eq(competition.id, competitionId));
	if (!comp) {
		throw new Error("Competition not found");
	}
	return comp;
};

export const getBySlug = async ({
	db,
	competitionSlug,
}: {
	db: DrizzleDB;
	competitionSlug: string;
}) => {
	const [comp] = await db.select().from(competition).where(eq(competition.slug, competitionSlug));
	if (!comp) {
		throw new Error("Competition not found");
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
		.select(getTableColumns(competition))
		.from(competition)
		.innerJoin(organization, eq(organization.id, competition.organizationId))
		.where(
			and(
				eq(competition.organizationId, organizationId),
				eq(competition.closed, false),
				lt(competition.startDate, now),
				or(isNull(competition.endDate), gt(competition.endDate, now))
			)
		);
	return comp;
};

export const getAll = async ({ db, organizationId }: { db: DrizzleDB; organizationId: string }) =>
	db
		.select(getTableColumns(competition))
		.from(competition)
		.where(eq(competition.organizationId, organizationId))
		.orderBy(desc(competition.startDate));

export const update = async ({
	db,
	userId,
	competitionId,
	...rest
}: CompetitionEditInput & { db: DrizzleDB }) => {
	const now = new Date();
	const [comp] = await db
		.update(competition)
		.set({
			updatedAt: now,
			updatedBy: userId,
			...rest,
		})
		.where(eq(competition.id, competitionId))
		.returning();
	return comp;
};

export const updateClosedStatus = async ({
	db,
	competitionId,
	userId,
	closed,
}: {
	db: DrizzleDB;
	competitionId: string;
	userId: string;
	closed: boolean;
}) => {
	const now = new Date();
	const [comp] = await db
		.update(competition)
		.set({
			closed,
			updatedAt: now,
			updatedBy: userId,
		})
		.where(eq(competition.id, competitionId))
		.returning();
	return comp;
};

export const create = async ({ db, ...input }: CompetitionCreateInput & { db: DrizzleDB }) => {
	const slug = await slugifyCompetitionName({ db, name: input.name });
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

	const comps = await db.insert(competition).values(values).returning();
	const comp = comps[0]!;

	// Get all enabled players from organization and create competition players
	const players = await db
		.select({ id: player.id })
		.from(player)
		.where(and(eq(player.organizationId, input.organizationId), eq(player.disabled, false)));

	const competitionPlayerValues = players.map((p) => ({
		id: crypto.randomUUID(),
		disabled: false,
		score: comp.initialScore,
		playerId: p.id,
		competitionId: comp.id,
		createdAt: now,
		updatedAt: now,
	}));

	if (competitionPlayerValues.length > 0) {
		await db.insert(competitionPlayer).values(competitionPlayerValues);
	}

	// If 3-1-0 with rounds, generate fixtures
	if (input.scoreType === "3-1-0" && input.rounds && input.rounds > 0) {
		const competitionPlayerIds = competitionPlayerValues.map((cp) => cp.id);
		const fixturesList: (typeof fixture.$inferInsert)[] = [];

		const playersList: Array<string | null> = [...competitionPlayerIds];
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
						competitionId: comp.id,
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

export const findFixtures = async ({
	db,
	competitionId,
}: {
	db: DrizzleDB;
	competitionId: string;
}) => {
	return db
		.select()
		.from(fixture)
		.where(eq(fixture.competitionId, competitionId))
		.orderBy(asc(fixture.round), asc(fixture.createdAt), asc(fixture.homePlayerId));
};

export const findFixtureById = async ({
	db,
	competitionId,
	fixtureId,
}: {
	db: DrizzleDB;
	competitionId: string;
	fixtureId: string;
}) => {
	const [f] = await db
		.select()
		.from(fixture)
		.where(and(eq(fixture.competitionId, competitionId), eq(fixture.id, fixtureId)))
		.limit(1);
	return f;
};

export const assignMatchToFixture = async ({
	db,
	competitionId,
	fixtureId,
	matchId,
}: {
	db: DrizzleDB;
	competitionId: string;
	fixtureId: string;
	matchId: string;
}) => {
	await db
		.update(fixture)
		.set({ matchId })
		.where(and(eq(fixture.competitionId, competitionId), eq(fixture.id, fixtureId)));
};

export const slugifyCompetitionName = async ({ db, name }: { db: DrizzleDB; name: string }) => {
	const doesSlugExist = async (_slug: string) =>
		db.select().from(competition).where(eq(competition.slug, _slug)).limit(1);

	const rootSlug = slugifyWithCustomReplacement(name);
	let slug = rootSlug;
	let [slugExists] = await doesSlugExist(slug);
	let counter = 1;
	while (slugExists) {
		slug = `${rootSlug}-${counter}`;
		counter++;
		[slugExists] = await doesSlugExist(slug);
	}
	return slug;
};
