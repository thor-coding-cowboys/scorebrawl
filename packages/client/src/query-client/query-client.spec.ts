import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { createQueryClient } from "./index";

const DAY_MS = 24 * 60 * 60 * 1000;

function trpcErrorWithStatus(httpStatus: number): unknown {
	const error = Object.create(TRPCClientError.prototype) as { data?: unknown };
	error.data = { httpStatus };
	return error;
}

describe("createQueryClient", () => {
	it("applies the shared query and mutation defaults", () => {
		const { queries, mutations } = createQueryClient().getDefaultOptions();

		expect(queries?.staleTime).toBe(60_000);
		expect(queries?.refetchOnWindowFocus).toBe(false);
		expect(queries?.retryDelay?.(0, new Error())).toBe(2000);
		expect(queries?.retryDelay?.(10, new Error())).toBe(60_000);
		expect(mutations?.retry).toBe(false);
	});

	it("defers gcTime to the library default when not provided", () => {
		expect(createQueryClient().getDefaultOptions().queries?.gcTime).toBeUndefined();
	});

	it("accepts a gcTime override", () => {
		expect(createQueryClient({ gcTime: DAY_MS }).getDefaultOptions().queries?.gcTime).toBe(DAY_MS);
	});

	it("retries 5xx errors twice, never 4xx, and other errors twice", () => {
		const retry = createQueryClient().getDefaultOptions().queries?.retry;
		if (typeof retry !== "function") throw new Error("expected retry to be a function");

		expect(retry(0, trpcErrorWithStatus(500))).toBe(true);
		expect(retry(1, trpcErrorWithStatus(503))).toBe(true);
		expect(retry(2, trpcErrorWithStatus(500))).toBe(false);
		expect(retry(0, trpcErrorWithStatus(404))).toBe(false);
		expect(retry(1, new Error("boom"))).toBe(true);
		expect(retry(2, new Error("boom"))).toBe(false);
	});
});
