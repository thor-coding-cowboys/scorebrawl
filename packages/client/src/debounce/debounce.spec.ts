import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "./index";

describe("debounce", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("invokes once with the latest arguments after the delay", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 300);

		debounced(1);
		debounced(2);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(2);
	});

	it("does not invoke after cancel", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 300);

		debounced(1);
		debounced.cancel();
		vi.advanceTimersByTime(1000);

		expect(fn).not.toHaveBeenCalled();
	});

	it("invokes again for a later call", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 300);

		debounced(1);
		vi.advanceTimersByTime(300);
		debounced(2);
		vi.advanceTimersByTime(300);

		expect(fn).toHaveBeenNthCalledWith(1, 1);
		expect(fn).toHaveBeenNthCalledWith(2, 2);
	});
});
