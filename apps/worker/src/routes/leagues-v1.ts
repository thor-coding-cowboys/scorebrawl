import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import type { HonoEnv } from "../middleware/context";
import { league as organization, member as memberTable } from "../db/schema/auth-schema";
import { scoreType, season as seasonTable } from "../db/schema/league-schema";
import { requireScope } from "./v1-auth";

const listSeasonsQuerySchema = z.object({
	excludeClosed: z
		.enum(["true", "false"])
		.optional()
		.transform((value) => value === "true"),
	scoreType: z.enum(scoreType).optional(),
});

export const leaguesV1Router = new Hono<HonoEnv>();

leaguesV1Router.get("/", requireScope("read:leagues"), async (c) => {
	const userId = c.get("oauthToken")?.sub;
	if (!userId) {
		return c.json({ error: "invalid_token" }, 401, {
			"WWW-Authenticate": 'Bearer error="invalid_token"',
		});
	}

	const leagues = await c
		.get("db")
		.select({
			id: organization.id,
			name: organization.name,
			slug: organization.slug,
			role: memberTable.role,
		})
		.from(memberTable)
		.innerJoin(organization, eq(organization.id, memberTable.organizationId))
		.where(eq(memberTable.userId, userId))
		.orderBy(asc(organization.name));

	return c.json({ items: leagues });
});

leaguesV1Router.get(
	"/:leagueId/seasons",
	requireScope("read:seasons"),
	zValidator("query", listSeasonsQuerySchema),
	async (c) => {
		const userId = c.get("oauthToken")?.sub;
		if (!userId) {
			return c.json({ error: "invalid_token" }, 401, {
				"WWW-Authenticate": 'Bearer error="invalid_token"',
			});
		}

		const db = c.get("db");
		const leagueId = c.req.param("leagueId");

		const [membership] = await db
			.select({ id: memberTable.id })
			.from(memberTable)
			.where(and(eq(memberTable.organizationId, leagueId), eq(memberTable.userId, userId)))
			.limit(1);
		if (!membership) {
			return c.json({ error: "not_found" }, 404);
		}

		const { excludeClosed, scoreType: scoreTypeFilter } = c.req.valid("query");
		const filters: SQL[] = [eq(seasonTable.leagueId, leagueId)];
		if (excludeClosed) {
			filters.push(eq(seasonTable.closed, false));
		}
		if (scoreTypeFilter) {
			filters.push(eq(seasonTable.scoreType, scoreTypeFilter));
		}

		const seasons = await db
			.select({
				id: seasonTable.id,
				name: seasonTable.name,
				slug: seasonTable.slug,
				scoreType: seasonTable.scoreType,
				closed: seasonTable.closed,
				archived: seasonTable.archived,
				startDate: seasonTable.startDate,
				endDate: seasonTable.endDate,
			})
			.from(seasonTable)
			.where(and(...filters))
			.orderBy(desc(seasonTable.startDate));

		return c.json({ items: seasons });
	}
);
