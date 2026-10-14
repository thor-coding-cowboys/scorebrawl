import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedScoreUpdate, type UpdateMatchScoreInput } from "./index";

type MatchRef = { current: { id: string } | null };

describe("createDebouncedScoreUpdate", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("sends the latest score for the current match after the delay", () => {
		const mutate = vi.fn<(input: UpdateMatchScoreInput) => void>();
		const currentMatchRef: MatchRef = { current: { id: "match-1" } };
		const debounced = createDebouncedScoreUpdate({ sessionId: "s1", currentMatchRef, mutate }, 300);

		debounced(1, 0);
		debounced(2, 1);
		expect(mutate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(300);
		expect(mutate).toHaveBeenCalledTimes(1);
		expect(mutate).toHaveBeenCalledWith({
			sessionId: "s1",
			sessionMatchId: "match-1",
			homeScore: 2,
			awayScore: 1,
		});
	});

	it("does nothing when there is no current match", () => {
		const mutate = vi.fn<(input: UpdateMatchScoreInput) => void>();
		const debounced = createDebouncedScoreUpdate(
			{ sessionId: "s1", currentMatchRef: { current: null }, mutate },
			300
		);

		debounced(1, 0);
		vi.advanceTimersByTime(300);

		expect(mutate).not.toHaveBeenCalled();
	});

	it("reads the current match when it fires, not when it is scheduled", () => {
		const mutate = vi.fn<(input: UpdateMatchScoreInput) => void>();
		const currentMatchRef: MatchRef = { current: { id: "match-1" } };
		const debounced = createDebouncedScoreUpdate({ sessionId: "s1", currentMatchRef, mutate }, 300);

		debounced(1, 0);
		currentMatchRef.current = { id: "match-2" };
		vi.advanceTimersByTime(300);

		expect(mutate).toHaveBeenCalledWith({
			sessionId: "s1",
			sessionMatchId: "match-2",
			homeScore: 1,
			awayScore: 0,
		});
	});

	it("does not send after cancel", () => {
		const mutate = vi.fn<(input: UpdateMatchScoreInput) => void>();
		const debounced = createDebouncedScoreUpdate(
			{ sessionId: "s1", currentMatchRef: { current: { id: "match-1" } }, mutate },
			300
		);

		debounced(1, 0);
		debounced.cancel();
		vi.advanceTimersByTime(1000);

		expect(mutate).not.toHaveBeenCalled();
	});
});
