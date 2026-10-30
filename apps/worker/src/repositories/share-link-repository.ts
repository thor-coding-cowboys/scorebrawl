import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { league as organization, user } from "../db/schema/auth-schema";
import { season } from "../db/schema/league-schema";
import { leagueSetting, shareLink } from "../db/schema/share-schema";

export const createShareLink = async ({
	db,
	leagueId,
	seasonId,
	createdBy,
	tokenHash,
	expiresAt,
}: {
	db: DrizzleDB;
	leagueId: string;
	seasonId: string;
	createdBy: string;
	tokenHash: string;
	expiresAt: Date | null;
}) => {
	const [row] = await db
		.insert(shareLink)
		.values({
			id: crypto.randomUUID(),
			leagueId,
			seasonId,
			createdBy,
			tokenHash,
			expiresAt,
		})
		.returning({
			id: shareLink.id,
			createdAt: shareLink.createdAt,
			expiresAt: shareLink.expiresAt,
		});

	return row;
};

export const listSeasonShareLinks = async ({
	db,
	leagueId,
	seasonId,
}: {
	db: DrizzleDB;
	leagueId: string;
	seasonId: string;
}) => {
	return db
		.select({
			id: shareLink.id,
			createdAt: shareLink.createdAt,
			createdByName: user.name,
			expiresAt: shareLink.expiresAt,
			revokedAt: shareLink.revokedAt,
			viewCount: shareLink.viewCount,
			lastViewedAt: shareLink.lastViewedAt,
		})
		.from(shareLink)
		.leftJoin(user, eq(user.id, shareLink.createdBy))
		.where(and(eq(shareLink.leagueId, leagueId), eq(shareLink.seasonId, seasonId)))
		.orderBy(desc(shareLink.createdAt));
};

export const revokeShareLink = async ({
	db,
	leagueId,
	seasonId,
	id,
	revokedBy,
}: {
	db: DrizzleDB;
	leagueId: string;
	seasonId: string;
	id: string;
	revokedBy: string;
}) => {
	const revoked = await db
		.update(shareLink)
		.set({ revokedAt: new Date(), revokedBy })
		.where(
			and(
				eq(shareLink.id, id),
				eq(shareLink.leagueId, leagueId),
				eq(shareLink.seasonId, seasonId),
				isNull(shareLink.revokedAt)
			)
		)
		.returning({ id: shareLink.id });

	return revoked.length > 0;
};

/** Resolves a link to the exact display data needed by the public page. */
export const resolveShareLink = async ({ db, tokenHash }: { db: DrizzleDB; tokenHash: string }) => {
	const [row] = await db
		.select({
			id: shareLink.id,
			leagueId: shareLink.leagueId,
			seasonId: shareLink.seasonId,
			expiresAt: shareLink.expiresAt,
			revokedAt: shareLink.revokedAt,
			createdAt: shareLink.createdAt,
			leagueName: organization.name,
			leagueLogo: organization.logo,
			seasonName: season.name,
			seasonStartDate: season.startDate,
			seasonClosed: season.closed,
			seasonArchived: season.archived,
			allowPublicShares: leagueSetting.allowPublicShares,
		})
		.from(shareLink)
		.innerJoin(organization, eq(organization.id, shareLink.leagueId))
		.innerJoin(season, eq(season.id, shareLink.seasonId))
		.leftJoin(leagueSetting, eq(leagueSetting.leagueId, shareLink.leagueId))
		.where(eq(shareLink.tokenHash, tokenHash))
		.limit(1);

	return row ?? null;
};

export const recordShareLinkView = async ({ db, id }: { db: DrizzleDB; id: string }) => {
	await db
		.update(shareLink)
		.set({ viewCount: sql`${shareLink.viewCount} + 1`, lastViewedAt: new Date() })
		.where(eq(shareLink.id, id));
};

export const getLeagueShareSetting = async ({
	db,
	leagueId,
}: {
	db: DrizzleDB;
	leagueId: string;
}) => {
	const [row] = await db
		.select({ allowPublicShares: leagueSetting.allowPublicShares })
		.from(leagueSetting)
		.where(eq(leagueSetting.leagueId, leagueId))
		.limit(1);

	return { allowPublicShares: row?.allowPublicShares ?? false };
};

/**
 * Sets the league switch and, when turning sharing off, revokes every link that
 * is still active. Batch keeps both statements in one D1 round trip.
 */
export const updateLeagueShareSetting = async ({
	db,
	leagueId,
	userId,
	allowPublicShares,
}: {
	db: DrizzleDB;
	leagueId: string;
	userId: string;
	allowPublicShares: boolean;
}) => {
	const now = new Date();
	const revokeStatement = db
		.update(shareLink)
		.set({ revokedAt: now, revokedBy: userId, updatedAt: now })
		.where(and(eq(shareLink.leagueId, leagueId), isNull(shareLink.revokedAt)))
		.returning({ id: shareLink.id });

	const settingStatement = db
		.insert(leagueSetting)
		.values({ leagueId, allowPublicShares })
		.onConflictDoUpdate({
			target: leagueSetting.leagueId,
			set: { allowPublicShares, updatedAt: now },
		});

	const [revokedRows] = await db.batch([revokeStatement, settingStatement]);

	return { revokedCount: allowPublicShares ? 0 : revokedRows.length };
};
