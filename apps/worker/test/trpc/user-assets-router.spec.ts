import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { type AuthContext, createAuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("profile router", () => {
	let ctx: AuthContext;

	beforeEach(async () => {
		ctx = await createAuthContext();
	});

	describe("getAvatarUploadUrl", () => {
		it("returns upload key and URL with default extension", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.userAssets.getUserAvatarUploadUrl.mutate({});

			expect(result.uploadKey).toBeDefined();
			expect(result.uploadUrl).toBeDefined();
			expect(result.token).toBeDefined();
			expect(result.expiresAt).toBeDefined();
			expect(result.uploadKey).toContain("avatars/");
			expect(result.uploadKey).toMatch(/\.jpg$/);
		});

		it("returns upload key with custom extension", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.userAssets.getUserAvatarUploadUrl.mutate({
				extension: "png",
			});

			expect(result.uploadKey).toBeDefined();
			expect(result.uploadKey).toContain("avatars/");
			expect(result.uploadKey).toMatch(/\.png$/);
		});

		it("returns upload key with custom contentType", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.userAssets.getUserAvatarUploadUrl.mutate({
				extension: "webp",
				contentType: "image/webp",
			});

			expect(result.uploadKey).toBeDefined();
			expect(result.uploadKey).toMatch(/\.webp$/);
		});

		it("returns unauthorized without session", async () => {
			const client = createTRPCTestClient();

			await expect(client.userAssets.getUserAvatarUploadUrl.mutate({})).rejects.toThrow(
				TRPCClientError
			);
		});
	});

	describe("deleteAvatar", () => {
		it("deletes avatar with valid key", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// First get an upload key
			const uploadResult = await client.userAssets.getUserAvatarUploadUrl.mutate({});
			const key = uploadResult.uploadKey;

			// Delete the avatar (even if it doesn't exist in R2, the delete should succeed)
			const result = await client.userAssets.deleteUserAvatar.mutate({ key });

			expect(result.success).toBe(true);
		});

		it("rejects invalid key that doesn't belong to user", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Try to delete an avatar with a key that doesn't belong to this user
			const invalidKey = "avatars/other-user-id/some-file.jpg";

			await expect(client.userAssets.deleteUserAvatar.mutate({ key: invalidKey })).rejects.toThrow(
				TRPCClientError
			);
		});

		it("rejects key that doesn't start with avatars prefix", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Get a valid key first to extract the user ID
			const uploadResult = await client.userAssets.getUserAvatarUploadUrl.mutate({});
			const validKeyParts = uploadResult.uploadKey.split("/");
			const userId = validKeyParts[1]; // avatars/{userId}/...

			// Try to delete with a key that doesn't have the avatars prefix
			const invalidKey = `other-prefix/${userId}/some-file.jpg`;

			await expect(client.userAssets.deleteUserAvatar.mutate({ key: invalidKey })).rejects.toThrow(
				TRPCClientError
			);
		});

		it("returns unauthorized without session", async () => {
			const client = createTRPCTestClient();

			await expect(
				client.userAssets.deleteUserAvatar.mutate({
					key: "avatars/some-user-id/file.jpg",
				})
			).rejects.toThrow(TRPCClientError);
		});
	});
});
