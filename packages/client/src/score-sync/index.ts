import { useEffect, useMemo, useRef } from "react";
import { debounce } from "../debounce";

export const SCORE_SYNC_DEBOUNCE_MS = 300;

export const REMOTE_SCORE_GRACE_MS = 1000;

export interface UpdateMatchScoreInput {
	sessionId: string;
	sessionMatchId: string;
	homeScore: number;
	awayScore: number;
}

export interface ScoreSyncGuard {
	markLocalActivity: () => void;
	trackSync: (run: () => unknown) => Promise<void>;
	shouldIgnoreRemoteScore: () => boolean;
}

/**
 * Guards local score state against stale echoes of our own writes.
 *
 * Every debounced score update is broadcast back to the sender, so remote
 * `session:score-update` events must be ignored from the first tap until a
 * grace window after the last sync settles. Echoes of older scores can arrive
 * long after a naive fixed debounce has expired.
 */
export function createScoreSyncGuard(
	graceMs: number = REMOTE_SCORE_GRACE_MS,
	now: () => number = Date.now
): ScoreSyncGuard {
	let lastLocalActivity: number | null = null;
	let inFlightSyncs = 0;

	return {
		markLocalActivity: () => {
			lastLocalActivity = now();
		},
		trackSync: (run) => {
			inFlightSyncs += 1;
			lastLocalActivity = now();
			return (async () => run())()
				.then(
					() => undefined,
					() => undefined
				)
				.finally(() => {
					inFlightSyncs -= 1;
					lastLocalActivity = now();
				});
		},
		shouldIgnoreRemoteScore: () => {
			if (inFlightSyncs > 0) return true;
			return lastLocalActivity !== null && now() - lastLocalActivity < graceMs;
		},
	};
}

interface DebouncedScoreUpdateOptions {
	sessionId: string;
	currentMatchRef: { current: { id: string } | null };
	mutate: (input: UpdateMatchScoreInput) => unknown;
}

export type DebouncedScoreUpdate = ((home: number, away: number) => void) & {
	cancel: () => void;
};

export interface ScoreSync {
	debouncedUpdateScore: DebouncedScoreUpdate;
	guard: ScoreSyncGuard;
}

export function createDebouncedScoreUpdate(
	{ sessionId, currentMatchRef, mutate }: DebouncedScoreUpdateOptions,
	delay = SCORE_SYNC_DEBOUNCE_MS,
	guard: ScoreSyncGuard = createScoreSyncGuard()
): ScoreSync {
	const debounced = debounce((home: number, away: number) => {
		const match = currentMatchRef.current;
		if (!match) return;
		guard.trackSync(() =>
			mutate({ sessionId, sessionMatchId: match.id, homeScore: home, awayScore: away })
		);
	}, delay);

	const debouncedUpdateScore = ((home: number, away: number) => {
		guard.markLocalActivity();
		debounced(home, away);
	}) as DebouncedScoreUpdate;
	debouncedUpdateScore.cancel = debounced.cancel;

	return { debouncedUpdateScore, guard };
}

export interface UseScoreSyncOptions {
	sessionId: string;
	currentMatchRef: { current: { id: string } | null };
	updateMatchScore: (input: UpdateMatchScoreInput) => unknown;
}

export function useScoreSync({
	sessionId,
	currentMatchRef,
	updateMatchScore,
}: UseScoreSyncOptions) {
	const updateMatchScoreRef = useRef(updateMatchScore);
	updateMatchScoreRef.current = updateMatchScore;

	const { debouncedUpdateScore, guard } = useMemo(
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

	return {
		debouncedUpdateScore,
		shouldIgnoreRemoteScore: guard.shouldIgnoreRemoteScore,
	};
}
