import { useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { debounce } from "@/lib/utils";

export function useScoreSync(sessionId: string, currentMatchRef: { current: { id: string } | null }) {
	const updateMatchScore = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			homeScore: number;
			awayScore: number;
		}) => trpcClient.session.updateMatchScore.mutate(input),
	});

	const debouncedUpdateScore = useMemo(
		() =>
			debounce((home: number, away: number) => {
				const match = currentMatchRef.current;
				if (!match) return;
				updateMatchScore.mutate({
					sessionId,
					sessionMatchId: match.id,
					homeScore: home,
					awayScore: away,
				});
			}, 300),
		[sessionId, currentMatchRef, updateMatchScore]
	);

	useEffect(() => {
		return () => debouncedUpdateScore.cancel();
	}, [debouncedUpdateScore]);

	return { debouncedUpdateScore };
}
