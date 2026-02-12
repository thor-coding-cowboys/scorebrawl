import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useTRPC } from "../trpc";

export const standingPlayerSchema = z.object({
	id: z.string(),
	seasonId: z.string(),
	playerId: z.string(),
	score: z.number(),
	name: z.string(),
	image: z.string().nullable(),
	userId: z.string(),
	matchCount: z.number(),
	winCount: z.number(),
	lossCount: z.number(),
	drawCount: z.number(),
	rank: z.number(),
	pointDiff: z.number(),
	form: z.array(z.enum(["W", "D", "L"])),
});

export type StandingPlayer = z.infer<typeof standingPlayerSchema>;

export function useStandings(seasonSlug: string) {
	const trpc = useTRPC();

	const { data: standings = [], isLoading } = useQuery(
		trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug })
	);

	return {
		standings,
		isLoading,
	};
}
