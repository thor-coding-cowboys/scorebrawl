import { useEffect, useMemo, useRef } from "react";
import { debounce } from "../debounce";

export const SCORE_SYNC_DEBOUNCE_MS = 300;

export interface UpdateMatchScoreInput {
	sessionId: string;
	sessionMatchId: string;
	homeScore: number;
	awayScore: number;
}

interface DebouncedScoreUpdateOptions {
	sessionId: string;
	currentMatchRef: { current: { id: string } | null };
	mutate: (input: UpdateMatchScoreInput) => void;
}

export function createDebouncedScoreUpdate(
	{ sessionId, currentMatchRef, mutate }: DebouncedScoreUpdateOptions,
	delay = SCORE_SYNC_DEBOUNCE_MS
) {
	return debounce((home: number, away: number) => {
		const match = currentMatchRef.current;
		if (!match) return;
		mutate({ sessionId, sessionMatchId: match.id, homeScore: home, awayScore: away });
	}, delay);
}

export interface UseScoreSyncOptions {
	sessionId: string;
	currentMatchRef: { current: { id: string } | null };
	updateMatchScore: (input: UpdateMatchScoreInput) => void;
}

export function useScoreSync({
	sessionId,
	currentMatchRef,
	updateMatchScore,
}: UseScoreSyncOptions) {
	const updateMatchScoreRef = useRef(updateMatchScore);
	updateMatchScoreRef.current = updateMatchScore;

	const debouncedUpdateScore = useMemo(
		() =>
			createDebouncedScoreUpdate({
				sessionId,
				currentMatchRef,
				mutate: (input) => updateMatchScoreRef.current(input),
			}),
		[sessionId, currentMatchRef]
	);

	useEffect(() => {
		return () => debouncedUpdateScore.cancel();
	}, [debouncedUpdateScore]);

	return { debouncedUpdateScore };
}
