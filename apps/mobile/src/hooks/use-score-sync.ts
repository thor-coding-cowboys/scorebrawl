import { useEffect, useMemo } from "react";

import { trpcClient } from "@/lib/trpc";

const SCORE_SYNC_DEBOUNCE_MS = 300;

function debounce<T extends (...args: Parameters<T>) => void>(
	fn: T,
	delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	const debounced = (...args: Parameters<T>) => {
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
	debounced.cancel = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};
	return debounced;
}

export function useScoreSync(
	sessionId: string,
	currentMatchRef: { current: { id: string } | null }
) {
	const debouncedUpdateScore = useMemo(
		() =>
			debounce((home: number, away: number) => {
				const match = currentMatchRef.current;
				if (!match) return;
				trpcClient.session.updateMatchScore
					.mutate({
						sessionId,
						sessionMatchId: match.id,
						homeScore: home,
						awayScore: away,
					})
					.catch(() => undefined);
			}, SCORE_SYNC_DEBOUNCE_MS),
		[sessionId, currentMatchRef]
	);

	useEffect(() => () => debouncedUpdateScore.cancel(), [debouncedUpdateScore]);

	return { debouncedUpdateScore };
}
