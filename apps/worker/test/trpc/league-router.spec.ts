import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { createLeague, createUser } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("league router", () => {
	let sessionToken: string;

	beforeEach(async () => {
		const { sessionToken: token } = await createUser();
		sessionToken = token;
	});

	it("lists user leagues", async () => {
		// Create leagues for testing
		await createLeague(sessionToken, {
			name: "Org Test Org 1",
			slug: "org-test-org-1",
		});
		await createLeague(sessionToken, {
			name: "Org Test Org 2",
			slug: "org-test-org-2",
		});

		const client = createTRPCTestClient({ sessionToken });

		const result = await client.league.list.query();

		expect(result.leagues).toBeInstanceOf(Array);
		expect(result.leagues.length).toBe(2);
	});

	it("checks slug availability - available", async () => {
		const client = createTRPCTestClient({ sessionToken });

		const result = await client.league.checkSlugAvailability.query({
			slug: "available-slug",
		});

		expect(result.available).toBe(true);
		expect(result.slug).toBe("available-slug");
	});

	it("checks slug availability - taken", async () => {
		const org1 = await createLeague(sessionToken, {
			name: "Org Test Org 1",
			slug: "org-test-org-1",
		});

		const client = createTRPCTestClient({ sessionToken });

		const result = await client.league.checkSlugAvailability.query({
			slug: org1.slug,
		});

		expect(result.available).toBe(false);
		expect(result.slug).toBe(org1.slug);
	});

	it("returns unauthorized without session", async () => {
		const client = createTRPCTestClient();

		await expect(client.league.list.query()).rejects.toThrow(TRPCClientError);
	});
});
