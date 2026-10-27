import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createDebouncedScoreUpdate,
	createScoreSyncGuard,
	SCORE_SYNC_DEBOUNCE_MS,
	REMOTE_SCORE_GRACE_MS,
	type UpdateMatchScoreInput,
} from "./index";

type MatchRef = { current: { id: string } | null };

describe("createScoreSyncGuard", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
	});
	afterEach(() => vi.useRealTimers());

	it("applies remote scores when there has been no local activity", () => {
		const guard = createScoreSyncGuard();

		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});

	it("ignores remote scores while a sync is in flight", async () => {
		const guard = createScoreSyncGuard();
		let settle!: () => void;
		const sync = guard.trackSync(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				})
		);

		expect(guard.shouldIgnoreRemoteScore()).toBe(true);

		settle();
		await sync;

		vi.setSystemTime(REMOTE_SCORE_GRACE_MS + 1);
		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});

	it("keeps ignoring after one of several in-flight syncs settles", async () => {
		const guard = createScoreSyncGuard();
		let settleFirst!: () => void;
		let settleSecond!: () => void;
		const first = guard.trackSync(
			() =>
				new Promise<void>((resolve) => {
					settleFirst = resolve;
				})
		);
		const second = guard.trackSync(
			() =>
				new Promise<void>((resolve) => {
					settleSecond = resolve;
				})
		);

		settleFirst();
		await first;
		expect(guard.shouldIgnoreRemoteScore()).toBe(true);

		settleSecond();
		await second;
		vi.setSystemTime(REMOTE_SCORE_GRACE_MS + 1);
		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});

	it("ignores remote scores inside the grace window after local activity", () => {
		const guard = createScoreSyncGuard();
		guard.markLocalActivity();

		vi.setSystemTime(REMOTE_SCORE_GRACE_MS - 1);
		expect(guard.shouldIgnoreRemoteScore()).toBe(true);

		vi.setSystemTime(REMOTE_SCORE_GRACE_MS);
		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});

	it("restarts the grace window when a sync settles", async () => {
		const guard = createScoreSyncGuard();
		const sync = guard.trackSync(() => Promise.resolve());
		await sync;

		vi.setSystemTime(REMOTE_SCORE_GRACE_MS - 1);
		expect(guard.shouldIgnoreRemoteScore()).toBe(true);

		vi.setSystemTime(REMOTE_SCORE_GRACE_MS);
		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});

	it("releases the guard when a sync fails", async () => {
		const guard = createScoreSyncGuard();
		const sync = guard.trackSync(() => {
			throw new Error("network down");
		});

		await expect(sync).resolves.toBeUndefined();

		vi.setSystemTime(REMOTE_SCORE_GRACE_MS + 1);
		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});
});

describe("createDebouncedScoreUpdate", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
	});
	afterEach(() => vi.useRealTimers());

	it("sends the latest score for the current match after the delay", () => {
		const mutate = vi.fn<(input: UpdateMatchScoreInput) => void>();
		const currentMatchRef: MatchRef = { current: { id: "match-1" } };
		const { debouncedUpdateScore } = createDebouncedScoreUpdate(
			{ sessionId: "s1", currentMatchRef, mutate },
			SCORE_SYNC_DEBOUNCE_MS
		);

		debouncedUpdateScore(1, 0);
		debouncedUpdateScore(2, 1);
		expect(mutate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(SCORE_SYNC_DEBOUNCE_MS);
		expect(mutate).toHaveBeenCalledTimes(1);
		expect(mutate).toHaveBeenCalledWith({
			sessionId: "s1",
			sessionMatchId: "match-1",
			homeScore: 2,
			awayScore: 1,
		});
	});

	it("ignores remote scores from the moment a tap is scheduled until the grace window ends", async () => {
		const currentMatchRef: MatchRef = { current: { id: "match-1" } };
		const { debouncedUpdateScore, guard } = createDebouncedScoreUpdate(
			{ sessionId: "s1", currentMatchRef, mutate: () => undefined },
			SCORE_SYNC_DEBOUNCE_MS
		);

		debouncedUpdateScore(1, 0);
		expect(guard.shouldIgnoreRemoteScore()).toBe(true);

		await vi.advanceTimersByTimeAsync(SCORE_SYNC_DEBOUNCE_MS);
		expect(guard.shouldIgnoreRemoteScore()).toBe(true);

		vi.setSystemTime(SCORE_SYNC_DEBOUNCE_MS + REMOTE_SCORE_GRACE_MS + 1);
		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});

	it("ignores remote scores while the sync request is in flight", async () => {
		const currentMatchRef: MatchRef = { current: { id: "match-1" } };
		let settle!: () => void;
		const { debouncedUpdateScore, guard } = createDebouncedScoreUpdate(
			{
				sessionId: "s1",
				currentMatchRef,
				mutate: () =>
					new Promise<void>((resolve) => {
						settle = resolve;
					}),
			},
			SCORE_SYNC_DEBOUNCE_MS
		);

		debouncedUpdateScore(1, 0);
		vi.advanceTimersByTime(SCORE_SYNC_DEBOUNCE_MS);

		vi.setSystemTime(REMOTE_SCORE_GRACE_MS + 1);
		expect(guard.shouldIgnoreRemoteScore()).toBe(true);

		settle();
		await vi.runAllTimersAsync();
		expect(guard.shouldIgnoreRemoteScore()).toBe(true);

		vi.setSystemTime(REMOTE_SCORE_GRACE_MS * 3);
		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});

	it("does nothing when there is no current match", () => {
		const mutate = vi.fn<(input: UpdateMatchScoreInput) => void>();
		const currentMatchRef: MatchRef = { current: null };
		const { debouncedUpdateScore, guard } = createDebouncedScoreUpdate(
			{ sessionId: "s1", currentMatchRef, mutate },
			SCORE_SYNC_DEBOUNCE_MS
		);

		debouncedUpdateScore(1, 0);
		vi.advanceTimersByTime(SCORE_SYNC_DEBOUNCE_MS);

		expect(mutate).not.toHaveBeenCalled();
		vi.setSystemTime(REMOTE_SCORE_GRACE_MS + 1);
		expect(guard.shouldIgnoreRemoteScore()).toBe(false);
	});

	it("reads the current match when it fires, not when it is scheduled", () => {
		const mutate = vi.fn<(input: UpdateMatchScoreInput) => void>();
		const currentMatchRef: MatchRef = { current: { id: "match-1" } };
		const { debouncedUpdateScore } = createDebouncedScoreUpdate(
			{ sessionId: "s1", currentMatchRef, mutate },
			SCORE_SYNC_DEBOUNCE_MS
		);

		debouncedUpdateScore(1, 0);
		currentMatchRef.current = { id: "match-2" };
		vi.advanceTimersByTime(SCORE_SYNC_DEBOUNCE_MS);

		expect(mutate).toHaveBeenCalledWith({
			sessionId: "s1",
			sessionMatchId: "match-2",
			homeScore: 1,
			awayScore: 0,
		});
	});

	it("does not send after cancel", () => {
		const mutate = vi.fn<(input: UpdateMatchScoreInput) => void>();
		const currentMatchRef: MatchRef = { current: { id: "match-1" } };
		const { debouncedUpdateScore } = createDebouncedScoreUpdate(
			{ sessionId: "s1", currentMatchRef, mutate },
			SCORE_SYNC_DEBOUNCE_MS
		);

		debouncedUpdateScore(1, 0);
		debouncedUpdateScore.cancel();
		vi.advanceTimersByTime(SCORE_SYNC_DEBOUNCE_MS);

		expect(mutate).not.toHaveBeenCalled();
	});
});
