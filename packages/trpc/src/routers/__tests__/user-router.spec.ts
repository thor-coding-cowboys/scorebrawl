import { createDb } from "@scorebrawl/database";
import type { Session, User } from "better-auth/types";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestLeague, createTestSession, createTestUser } from "../../../test/test-utils";
import { createCaller } from "../../root";
import type { TRPCContext } from "../../trpc";

describe("userRouter", () => {
  let mockContext: TRPCContext;
  let caller: ReturnType<typeof createCaller>;
  let testUser: User;
  let testSession: Session;

  beforeEach(async () => {
    // Create real test user and session
    testUser = await createTestUser({
      name: "Test User",
      email: "test@example.com",
      image: "https://example.com/avatar.jpg",
    });

    testSession = await createTestSession(testUser.id);

    mockContext = {
      headers: new Headers(),
      session: {
        session: testSession,
        user: testUser,
      },
      db: createDb(),
    };

    caller = createCaller(mockContext);
  });

  describe("me", () => {
    it("should return user information for authenticated user", async () => {
      const result = await caller.user.me();

      expect(result).toEqual({
        userId: testUser.id,
        name: "Test User",
        image: "https://example.com/avatar.jpg",
        defaultLeagueId: undefined,
      });
    });

    it("should return user with default league", async () => {
      // Create a league for the user
      const league = await createTestLeague(testUser.id, {
        name: "Test League",
      });

      // Update user to have default league
      const { createDb } = await import("@scorebrawl/database");
      const { setDefaultLeague } = await import(
        "@scorebrawl/database/repositories/user-repository"
      );
      await setDefaultLeague(createDb(), {
        leagueId: league.id,
        userId: testUser.id,
      });

      const result = await caller.user.me();

      expect(result).toEqual({
        userId: testUser.id,
        name: "Test User",
        image: "https://example.com/avatar.jpg",
        defaultLeagueId: league.id,
      });
    });

    it("should handle user without image", async () => {
      const userWithoutImage = await createTestUser({
        name: "No Image User",
        email: "noimage@example.com",
        image: null,
      });

      const session = await createTestSession(userWithoutImage.id);

      const context: TRPCContext = {
        headers: new Headers(),
        session: {
          session: session,
          user: userWithoutImage,
        },
        db: createDb(),
      };

      const localCaller = createCaller(context);
      const result = await localCaller.user.me();

      expect(result).toEqual({
        userId: userWithoutImage.id,
        name: "No Image User",
        image: undefined,
        defaultLeagueId: undefined,
      });
    });
  });

  describe("update", () => {
    it("should update user information", async () => {
      const input = {
        name: "Updated Name",
        image: "https://example.com/new-avatar.jpg",
      };

      await caller.user.update(input);

      // Verify the update by fetching the user
      const result = await caller.user.me();

      expect(result.name).toBe("Updated Name");
      expect(result.image).toBe("https://example.com/new-avatar.jpg");
    });

    it("should allow partial updates (name only)", async () => {
      await caller.user.update({ name: "Only Name Updated" });

      const result = await caller.user.me();

      expect(result.name).toBe("Only Name Updated");
      expect(result.image).toBe("https://example.com/avatar.jpg"); // Should remain unchanged
    });

    it("should allow partial updates (image only)", async () => {
      await caller.user.update({ image: "https://example.com/updated-avatar.jpg" });

      const result = await caller.user.me();

      expect(result.name).toBe("Test User"); // Should remain unchanged
      expect(result.image).toBe("https://example.com/updated-avatar.jpg");
    });
  });

  describe("setDefaultLeague", () => {
    it("should set default league for user", async () => {
      const league = await createTestLeague(testUser.id, {
        name: "Test League",
        slug: "test-league",
      });

      await caller.user.setDefaultLeague({ leagueSlug: "test-league" });

      const result = await caller.user.me();
      expect(result.defaultLeagueId).toBe(league.id);
    });

    it("should throw error when setting non-existent league", async () => {
      await expect(
        caller.user.setDefaultLeague({ leagueSlug: "non-existent-league" }),
      ).rejects.toThrow();
    });
  });
});
