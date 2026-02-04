import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { type AuthContext, createAuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

// Helper to create a small valid base64 PNG (1x1 pixel, red)
const createTestImageData = (contentType: string) => {
	// Tiny 1x1 red PNG in base64
	const base64Png =
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
	return `data:${contentType};base64,${base64Png}`;
};

describe("user router", () => {
	let ctx: AuthContext;

	beforeEach(async () => {
		ctx = await createAuthContext();
	});

	describe("uploadAvatar", () => {
		it("uploads avatar with valid base64 image data", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const imageData = createTestImageData("image/png");
			const result = await client.user.uploadAvatar.mutate({ imageData });

			expect(result.success).toBe(true);
			expect(result.key).toBeDefined();
			expect(result.key).toContain(`user/${ctx.user.id}/avatars/`);
		});

		it("accepts jpeg image data", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const imageData = createTestImageData("image/jpeg");
			const result = await client.user.uploadAvatar.mutate({ imageData });

			expect(result.success).toBe(true);
			expect(result.key).toBeDefined();
		});

		it("accepts webp image data", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const imageData = createTestImageData("image/webp");
			const result = await client.user.uploadAvatar.mutate({ imageData });

			expect(result.success).toBe(true);
			expect(result.key).toBeDefined();
		});

		it("rejects invalid content type", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const imageData = createTestImageData("image/gif");

			await expect(client.user.uploadAvatar.mutate({ imageData })).rejects.toThrow(TRPCClientError);
		});

		it("rejects invalid base64 format", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			await expect(client.user.uploadAvatar.mutate({ imageData: "invalid-data" })).rejects.toThrow(
				TRPCClientError
			);
		});

		it("returns unauthorized without session", async () => {
			const client = createTRPCTestClient();

			const imageData = createTestImageData("image/png");

			await expect(client.user.uploadAvatar.mutate({ imageData })).rejects.toThrow(TRPCClientError);
		});
	});

	describe("deleteAvatar", () => {
		it("deletes avatar successfully", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// First upload an avatar
			const imageData = createTestImageData("image/png");
			await client.user.uploadAvatar.mutate({ imageData });

			// Then delete it
			const result = await client.user.deleteAvatar.mutate();

			expect(result.success).toBe(true);
		});

		it("returns success when no avatar exists", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.user.deleteAvatar.mutate();

			expect(result.success).toBe(true);
		});

		it("returns unauthorized without session", async () => {
			const client = createTRPCTestClient();

			await expect(client.user.deleteAvatar.mutate()).rejects.toThrow(TRPCClientError);
		});
	});
});
