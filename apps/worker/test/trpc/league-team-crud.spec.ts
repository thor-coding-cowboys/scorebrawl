import { env } from "cloudflare:test";
import { randUuid } from "@ngneat/falso";
import { TRPCClientError } from "@trpc/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import { member, session } from "../../src/db/schema/auth-schema";
import { leagueTeam } from "../../src/db/schema/league-schema";
import { type AuthContext, createAuthContext, createUser } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

type TestClient = ReturnType<typeof createTRPCTestClient>;

const tinyPng =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function addMemberToLeague(ctx: AuthContext, role: string) {
	const db = getDb(env.DB);
	const memberUser = await createUser();
	await db.insert(member).values({
		id: randUuid(),
		organizationId: ctx.league.id,
		userId: memberUser.user.id,
		role,
		createdAt: new Date(),
	});
	await db
		.update(session)
		.set({ activeOrganizationId: ctx.league.id, updatedAt: new Date() })
		.where(eq(session.userId, memberUser.user.id));
	return createTRPCTestClient({ sessionToken: memberUser.sessionToken });
}

async function errorOf(fn: () => Promise<unknown>) {
	try {
		await fn();
	} catch (err) {
		if (err instanceof TRPCClientError) return { code: err.data?.code, message: err.message };
		throw err;
	}
	return undefined;
}

describe("league-team CRUD", () => {
	let ctx: AuthContext;
	let client: TestClient;

	beforeEach(async () => {
		ctx = await createAuthContext();
		client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	});

	describe("create", () => {
		it("creates a team without a logo", async () => {
			const { team } = await client.leagueTeam.create.mutate({ name: "  Office Pair  " });

			expect(team.name).toBe("Office Pair");
			expect(team.logo).toBeNull();

			const list = await client.leagueTeam.list.query({});
			expect(list.teams.map((t) => t.id)).toContain(team.id);
		});

		it("creates a team with a logo", async () => {
			const { team } = await client.leagueTeam.create.mutate({
				name: "Logo Team",
				imageData: tinyPng,
			});

			expect(team.logo).toMatch(
				new RegExp(`^organization/${ctx.league.id}/teams/${team.id}/logos/.+\\.png$`)
			);
		});

		it("allows editors to create teams", async () => {
			const editor = await addMemberToLeague(ctx, "editor");
			const { team } = await editor.leagueTeam.create.mutate({ name: "Editor Team" });
			expect(team.name).toBe("Editor Team");
		});

		it("forbids members from creating teams", async () => {
			const memberClient = await addMemberToLeague(ctx, "member");
			const error = await errorOf(() => memberClient.leagueTeam.create.mutate({ name: "Nope" }));
			expect(error?.code).toBe("FORBIDDEN");
		});

		it("rejects an empty name", async () => {
			const error = await errorOf(() => client.leagueTeam.create.mutate({ name: "   " }));
			expect(error?.code).toBe("BAD_REQUEST");
		});
	});

	describe("roster", () => {
		it("adds and removes players", async () => {
			const [p1, p2] = await createPlayers(ctx, 2);
			const { team } = await client.leagueTeam.create.mutate({ name: "Roster Team" });

			await client.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: p1.id });
			await client.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: p2.id });

			const roster = await client.leagueTeam.getPlayers.query({ teamId: team.id });
			expect(roster.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort());

			await client.leagueTeam.removePlayer.mutate({ teamId: team.id, playerId: p1.id });

			const after = await client.leagueTeam.getPlayers.query({ teamId: team.id });
			expect(after.map((p) => p.id)).toEqual([p2.id]);
		});

		it("rejects adding a player twice", async () => {
			const [p1] = await createPlayers(ctx, 1);
			const { team } = await client.leagueTeam.create.mutate({ name: "Dup Team" });
			await client.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: p1.id });

			const error = await errorOf(() =>
				client.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: p1.id })
			);
			expect(error?.code).toBe("CONFLICT");
		});

		it("rejects removing a player who is not on the team", async () => {
			const [p1] = await createPlayers(ctx, 1);
			const { team } = await client.leagueTeam.create.mutate({ name: "Empty Team" });

			const error = await errorOf(() =>
				client.leagueTeam.removePlayer.mutate({ teamId: team.id, playerId: p1.id })
			);
			expect(error?.code).toBe("NOT_FOUND");
		});

		it("rejects a player from another league", async () => {
			const { team } = await client.leagueTeam.create.mutate({ name: "Home Team" });
			const otherCtx = await createAuthContext();
			const [foreignPlayer] = await createPlayers(otherCtx, 1);

			const error = await errorOf(() =>
				client.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: foreignPlayer.id })
			);
			expect(error).toEqual({ code: "NOT_FOUND", message: "Player not found" });
		});

		it("rejects a team from another league", async () => {
			const [p1] = await createPlayers(ctx, 1);
			const otherCtx = await createAuthContext();
			const otherClient = createTRPCTestClient({ sessionToken: otherCtx.sessionToken });
			const { team } = await otherClient.leagueTeam.create.mutate({ name: "Foreign Team" });

			const error = await errorOf(() =>
				client.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: p1.id })
			);
			expect(error).toEqual({ code: "NOT_FOUND", message: "Team not found" });
		});

		it("forbids members from changing the roster", async () => {
			const [p1] = await createPlayers(ctx, 1);
			const { team } = await client.leagueTeam.create.mutate({ name: "Locked Team" });
			await client.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: p1.id });
			const memberClient = await addMemberToLeague(ctx, "member");

			const addError = await errorOf(() =>
				memberClient.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: p1.id })
			);
			const removeError = await errorOf(() =>
				memberClient.leagueTeam.removePlayer.mutate({ teamId: team.id, playerId: p1.id })
			);
			expect(addError?.code).toBe("FORBIDDEN");
			expect(removeError?.code).toBe("FORBIDDEN");
		});
	});

	describe("delete", () => {
		it("deletes a team without match history", async () => {
			const [p1] = await createPlayers(ctx, 1);
			const { team } = await client.leagueTeam.create.mutate({ name: "Short Lived" });
			await client.leagueTeam.addPlayer.mutate({ teamId: team.id, playerId: p1.id });

			await client.leagueTeam.delete.mutate({ teamId: team.id });

			const db = getDb(env.DB);
			const rows = await db.select().from(leagueTeam).where(eq(leagueTeam.id, team.id));
			expect(rows).toHaveLength(0);
		});

		it("blocks deleting a team with match history", async () => {
			await createPlayers(ctx, 4);
			const season = await client.season.create.mutate({
				name: "History Season",
				initialScore: 1000,
				scoreType: "elo",
				kFactor: 32,
				startDate: new Date(),
			});
			const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
			await client.match.create.mutate({
				seasonSlug: season.slug,
				homeScore: 2,
				awayScore: 1,
				homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});
			const { teams } = await client.leagueTeam.list.query({});
			expect(teams.length).toBeGreaterThan(0);

			const error = await errorOf(() => client.leagueTeam.delete.mutate({ teamId: teams[0].id }));

			expect(error).toEqual({
				code: "PRECONDITION_FAILED",
				message: "This team has match history and cannot be deleted",
			});
			const after = await client.leagueTeam.list.query({});
			expect(after.teams.map((t) => t.id)).toContain(teams[0].id);
		});

		it("forbids members from deleting teams", async () => {
			const { team } = await client.leagueTeam.create.mutate({ name: "Protected" });
			const memberClient = await addMemberToLeague(ctx, "member");

			const error = await errorOf(() => memberClient.leagueTeam.delete.mutate({ teamId: team.id }));
			expect(error?.code).toBe("FORBIDDEN");
		});

		it("returns NOT_FOUND for a team in another league", async () => {
			const otherCtx = await createAuthContext();
			const otherClient = createTRPCTestClient({ sessionToken: otherCtx.sessionToken });
			const { team } = await otherClient.leagueTeam.create.mutate({ name: "Foreign Team" });

			const error = await errorOf(() => client.leagueTeam.delete.mutate({ teamId: team.id }));
			expect(error?.code).toBe("NOT_FOUND");
		});
	});
});
