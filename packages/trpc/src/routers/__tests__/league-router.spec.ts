import { createDb } from "@scorebrawl/database";
import { db } from "@scorebrawl/database/db";
import type { Session, User } from "better-auth/types";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createTestLeague,
  createTestLeagueMember,
  createTestSession,
  createTestUser,
} from "../../../test/test-utils";
import { createCaller } from "../../root";
import type { TRPCContext } from "../../trpc";

describe("leagueRouter", () => {
  let user: User;
  let session: Session;
  let mockContext: TRPCContext;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(async () => {
    // Create real test data
    user = await createTestUser({ name: "Test User", email: "test@example.com" });
    session = await createTestSession(user.id);

    mockContext = {
      headers: new Headers(),
      session: {
        session: session,
        user,
      },
      db: createDb(),
    };

    caller = createCaller(mockContext);
  });

  describe("create", () => {
    it("should create a new league", async () => {
      const input = {
        name: "Test League",
        logoUrl: "https://example.com/logo.jpg",
      };

      const result = await caller.league.create(input);

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result?.name).toBe("Test League");
      expect(result.logoUrl).toBe("https://example.com/logo.jpg");
      expect(result.createdBy).toBe(user.id);

      // Verify in database
      const dbLeague = await db.query.Leagues.findFirst({
        where: (leagues, { eq }) => eq(leagues.id, result.id),
      });
      expect(dbLeague).toBeDefined();
      if (!dbLeague) throw new Error("Expected dbLeague");
      expect(dbLeague?.name).toBe("Test League");

      // Verify creator is added as owner
      const dbMember = await db.query.LeagueMembers.findFirst({
        where: (members, { and, eq }) =>
          and(eq(members.leagueId, result.id), eq(members.userId, user.id)),
      });
      expect(dbMember).toBeDefined();
      if (!dbMember) throw new Error("Expected dbMember");
      expect(dbMember?.role).toBe("owner");
    });
  });

  describe("getAll", () => {
    it("should return all user's leagues", async () => {
      // Create test leagues
      const _league1 = await createTestLeague(user.id, { name: "League One" });
      const _league2 = await createTestLeague(user.id, { name: "League Two" });

      const result = await caller.league.getAll();

      expect(result).toHaveLength(2);
      expect(result.map((l) => l.name).sort()).toEqual(["League One", "League Two"]);
    });

    it("should filter leagues by search term", async () => {
      await createTestLeague(user.id, { name: "Alpha League" });
      await createTestLeague(user.id, { name: "Beta League" });

      const result = await caller.league.getAll({ search: "alpha" });

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Alpha League");
    });

    it("should return empty array when user has no leagues", async () => {
      const result = await caller.league.getAll();

      expect(result).toHaveLength(0);
    });
  });

  describe("getLeagueBySlugAndRole", () => {
    it("should return league with user role", async () => {
      const league = await createTestLeague(user.id, { name: "Test League" });

      const result = await caller.league.getLeagueBySlugAndRole({
        leagueSlug: league.slug,
      });

      expect(result).toBeDefined();
      if (!result) throw new Error("Expected result");
      expect(result?.id).toBe(league.id);
      expect(result.name).toBe("Test League");
      expect(result.role).toBe("owner");
    });

    it("should return undefined logoUrl if null", async () => {
      const league = await createTestLeague(user.id, { name: "Test League", logoUrl: undefined });

      const result = await caller.league.getLeagueBySlugAndRole({
        leagueSlug: league.slug,
      });

      expect(result.logoUrl).toBeUndefined();
    });

    it("should throw NOT_FOUND if league does not exist", async () => {
      await expect(
        caller.league.getLeagueBySlugAndRole({
          leagueSlug: "non-existent",
        }),
      ).rejects.toThrow();
    });

    it("should throw NOT_FOUND if user is not a member", async () => {
      // Create league with different user
      const otherUser = await createTestUser({ name: "Other User" });
      const league = await createTestLeague(otherUser.id, { name: "Private League" });

      await expect(
        caller.league.getLeagueBySlugAndRole({
          leagueSlug: league.slug,
        }),
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("should update league as editor", async () => {
      const league = await createTestLeague(user.id, { name: "Test League" });

      // Create another user and add them as editor
      const editorUser = await createTestUser({ name: "Editor User" });
      const editorSession = await createTestSession(editorUser.id);
      await createTestLeagueMember(league.id, editorUser.id, "editor");

      const editorContext: TRPCContext = {
        headers: new Headers(),
        session: {
          session: editorSession,
          user: editorUser,
        },
        db: createDb(),
      };
      const editorCaller = createCaller(editorContext);

      const input = {
        leagueSlug: league.slug,
        name: "Updated League",
        logoUrl: "https://example.com/new-logo.jpg",
      };

      const result = await editorCaller.league.update(input);

      expect(result.name).toBe("Updated League");
      expect(result.logoUrl).toBe("https://example.com/new-logo.jpg");

      // Verify in database
      const dbLeague = await db.query.Leagues.findFirst({
        where: (leagues, { eq }) => eq(leagues.id, league.id),
      });
      expect(dbLeague?.name).toBe("Updated League");
    });

    it("should update league as owner", async () => {
      const league = await createTestLeague(user.id, { name: "Test League" });

      const input = {
        leagueSlug: league.slug,
        name: "Updated League",
      };

      const result = await caller.league.update(input);

      expect(result.name).toBe("Updated League");
    });

    it("should throw FORBIDDEN if user is not editor or owner", async () => {
      const league = await createTestLeague(user.id, { name: "Test League" });

      // Create member user (not editor or owner)
      const memberUser = await createTestUser({ name: "Member User" });
      const memberSession = await createTestSession(memberUser.id);
      await createTestLeagueMember(league.id, memberUser.id, "member");

      const memberContext: TRPCContext = {
        headers: new Headers(),
        session: {
          session: memberSession,
          user: memberUser,
        },
        db: createDb(),
      };
      const memberCaller = createCaller(memberContext);

      const input = {
        leagueSlug: league.slug,
        name: "Updated League",
      };

      await expect(memberCaller.league.update(input)).rejects.toThrow();
    });
  });

  describe("hasEditorAccess", () => {
    it("should return true for owner", async () => {
      const league = await createTestLeague(user.id, { name: "Test League" });

      const result = await caller.league.hasEditorAccess({
        leagueSlug: league.slug,
      });

      expect(result).toBe(true);
    });

    it("should return true for editor", async () => {
      const league = await createTestLeague(user.id, { name: "Test League" });

      const editorUser = await createTestUser({ name: "Editor User" });
      const editorSession = await createTestSession(editorUser.id);
      await createTestLeagueMember(league.id, editorUser.id, "editor");

      const editorContext: TRPCContext = {
        headers: new Headers(),
        session: {
          session: editorSession,
          user: editorUser,
        },
        db: createDb(),
      };
      const editorCaller = createCaller(editorContext);

      const result = await editorCaller.league.hasEditorAccess({
        leagueSlug: league.slug,
      });

      expect(result).toBe(true);
    });

    it("should return false for member", async () => {
      const league = await createTestLeague(user.id, { name: "Test League" });

      const memberUser = await createTestUser({ name: "Member User" });
      const memberSession = await createTestSession(memberUser.id);
      await createTestLeagueMember(league.id, memberUser.id, "member");

      const memberContext: TRPCContext = {
        headers: new Headers(),
        session: {
          session: memberSession,
          user: memberUser,
        },
        db: createDb(),
      };
      const memberCaller = createCaller(memberContext);

      const result = await memberCaller.league.hasEditorAccess({
        leagueSlug: league.slug,
      });

      expect(result).toBe(false);
    });
  });

  describe("access control", () => {
    it("should throw UNAUTHORIZED if user is not authenticated", async () => {
      const unauthContext: TRPCContext = {
        headers: new Headers(),
        session: {
          id: "",
          userId: "",
          expiresAt: new Date(),
          token: "",
          ipAddress: "",
          userAgent: "",
          createdAt: new Date(),
          updatedAt: new Date(),
          // @ts-expect-error - intentionally missing user for test
          user: undefined,
        },
        db: createDb(),
      };

      const unauthCaller = createCaller(unauthContext);

      await expect(unauthCaller.league.getAll()).rejects.toThrow();
    });

    it("should require league membership for getLeagueBySlugAndRole", async () => {
      const otherUser = await createTestUser({ name: "Other User" });
      const league = await createTestLeague(otherUser.id, { name: "Private League" });

      await expect(
        caller.league.getLeagueBySlugAndRole({ leagueSlug: league.slug }),
      ).rejects.toThrow();
    });
  });
});
