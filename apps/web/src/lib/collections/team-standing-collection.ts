import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useTRPC } from "../trpc";

const playerSchema = z.object({
	id: z.string(),
	name: z.string(),
	image: z.string().nullable(),
});

export const standingTeamSchema = z.object({
	id: z.string(),
	seasonId: z.string(),
	leagueTeamId: z.string(),
	score: z.number(),
	name: z.string(),
	logo: z.string().nullable(),
	matchCount: z.number(),
	winCount: z.number(),
	lossCount: z.number(),
	drawCount: z.number(),
	rank: z.number(),
	pointDiff: z.number(),
	form: z.array(z.enum(["W", "D", "L"])),
	players: z.array(playerSchema),
});

export type StandingTeam = z.infer<typeof standingTeamSchema>;

export function useTeamStandings(seasonSlug: string) {
	const trpc = useTRPC();

	const { data: teamStandings = [], isLoading } = useQuery(
		trpc.seasonTeam.getStanding.queryOptions({ seasonSlug })
	);

	return {
		teamStandings,
		isLoading,
	};
}
