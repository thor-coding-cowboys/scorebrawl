import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuthContext, createUser, type AuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

// Helper to create a small valid base64 PNG (1x1 pixel, red)
const createTestImageData = (contentType: string) => {
	// Tiny 1x1 red PNG in base64
	const base64Png =
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
	return `data:${contentType};base64,${base64Png}`;
};

describe("organization router", () => {
	let ctx: AuthContext;

	beforeEach(async () => {
		ctx = await createAuthContext();
	});

	describe("uploadLogo", () => {
		it("uploads logo with valid base64 image data", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const imageData = createTestImageData("image/png");
			const result = await client.organization.uploadLogo.mutate({ imageData });

			expect(result.success).toBe(true);
			expect(result.key).toBeDefined();
			expect(result.key).toContain(`organization/${ctx.league.id}/logos/`);
		});

		it("accepts image/jpeg content type", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const imageData = createTestImageData("image/jpeg");
			const result = await client.organization.uploadLogo.mutate({ imageData });

			expect(result.success).toBe(true);
			expect(result.key).toBeDefined();
		});

		it("accepts image/webp content type", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const imageData = createTestImageData("image/webp");
			const result = await client.organization.uploadLogo.mutate({ imageData });

			expect(result.success).toBe(true);
			expect(result.key).toBeDefined();
		});

		it("rejects invalid content type", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const imageData = createTestImageData("image/gif");

			await expect(client.organization.uploadLogo.mutate({ imageData })).rejects.toThrow(
				TRPCClientError
			);
		});

		it("rejects invalid base64 format", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			await expect(
				client.organization.uploadLogo.mutate({ imageData: "invalid-data" })
			).rejects.toThrow(TRPCClientError);
		});

		it("returns unauthorized without session", async () => {
			const client = createTRPCTestClient();

			const imageData = createTestImageData("image/png");

			await expect(client.organization.uploadLogo.mutate({ imageData })).rejects.toThrow(
				TRPCClientError
			);
		});

		it("requires organization editor role", async () => {
			// Create a user without an active organization
			const { sessionToken } = await createUser();

			const client = createTRPCTestClient({ sessionToken });
			const imageData = createTestImageData("image/png");

			// Should fail because no active organization is set
			await expect(client.organization.uploadLogo.mutate({ imageData })).rejects.toThrow(
				TRPCClientError
			);
		});
	});

	describe("deleteLogo", () => {
		it("deletes logo successfully", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// First upload a logo
			const imageData = createTestImageData("image/png");
			await client.organization.uploadLogo.mutate({ imageData });

			// Then delete it
			const result = await client.organization.deleteLogo.mutate();

			expect(result.success).toBe(true);
		});

		it("returns success when no logo exists", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.organization.deleteLogo.mutate();

			expect(result.success).toBe(true);
		});

		it("returns unauthorized without session", async () => {
			const client = createTRPCTestClient();

			await expect(client.organization.deleteLogo.mutate()).rejects.toThrow(TRPCClientError);
		});
	});
});
