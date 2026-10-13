import { useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { debounce } from "@/lib/utils";

export function useScoreSync(
	sessionId: string,
	currentMatchRef: { current: { id: string } | null }
) {
	const updateMatchScore = useMutation({
		mutationFn: (input: {
			sessionId: string;
			sessionMatchId: string;
			homeScore: number;
			awayScore: number;
		}) => trpcClient.session.updateMatchScore.mutate(input),
	});

	const mutateRef = useRef(updateMatchScore.mutate);
	mutateRef.current = updateMatchScore.mutate;

	const debouncedUpdateScore = useMemo(
		() =>
			debounce((home: number, away: number) => {
				const match = currentMatchRef.current;
				if (!match) return;
				mutateRef.current({
					sessionId,
					sessionMatchId: match.id,
					homeScore: home,
					awayScore: away,
				});
			}, 300),
		[sessionId, currentMatchRef]
	);

	useEffect(() => {
		return () => debouncedUpdateScore.cancel();
	}, [debouncedUpdateScore]);

	return { debouncedUpdateScore };
}
