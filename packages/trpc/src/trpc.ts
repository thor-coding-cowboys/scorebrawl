import { ScoreBrawlError } from "@scorebrawl/database";
import { findBySlugWithUserRole } from "@scorebrawl/database/repositories/league-repository";
import { findSeasonAndLeagueBySlug } from "@scorebrawl/database/repositories/season-repository";
import { TRPCError, initTRPC } from "@trpc/server";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/rpc";
import type { Session, User } from "better-auth/types";
import superjson from "superjson";
import { ZodError, z } from "zod";

// Editor roles constant
export const editorRoles = ["owner", "editor"];

export type TRPCContext = {
  headers: Headers;
  session: { session: Session; user: User } | null;
};

type Context = TRPCContext;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (error.cause instanceof ScoreBrawlError) {
      return {
        message: error.message,
        // Todo map error codes
        code: TRPC_ERROR_CODES_BY_KEY.NOT_FOUND,
        data: {
          code: "NOT_FOUND",
          httpStatus: 404,
        },
      };
    }
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session,
    },
  });
});

const leagueAccessMiddleware = isAuthed.unstable_pipe(async ({ ctx, input, next }) => {
  const leagueWithUserRole = await findBySlugWithUserRole({
    userId: ctx.session.user.id,
    leagueSlug: (input as { leagueSlug: string }).leagueSlug ?? "",
  });
  if (!leagueWithUserRole) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  return next({
    ctx: {
      ...ctx,
      league: {
        id: leagueWithUserRole.id,
        slug: leagueWithUserRole.slug,
        logoUrl: leagueWithUserRole.logoUrl,
        name: leagueWithUserRole.name,
      },
      role: leagueWithUserRole.role,
    },
  });
});

const seasonAccessMiddleware = isAuthed.unstable_pipe(async ({ ctx, input, next }) => {
  const { leagueSlug, seasonSlug } = input as {
    leagueSlug: string;
    seasonSlug: string;
  };
  const seasonWithLeagueAndRole = await findSeasonAndLeagueBySlug({
    userId: ctx.session.user.id,
    leagueSlug,
    seasonSlug,
  });

  if (!seasonWithLeagueAndRole) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  return next({
    ctx: {
      ...ctx,
      league: {
        id: seasonWithLeagueAndRole.leagueId,
        slug: seasonWithLeagueAndRole.leagueSlug,
        name: seasonWithLeagueAndRole.leagueName,
      },
      season: {
        id: seasonWithLeagueAndRole.seasonId,
        slug: seasonWithLeagueAndRole.seasonSlug,
        leagueId: seasonWithLeagueAndRole.leagueId,
        name: seasonWithLeagueAndRole.seasonName,
        startDate: seasonWithLeagueAndRole.startDate,
        endDate: seasonWithLeagueAndRole.endDate,
        initialScore: seasonWithLeagueAndRole.initialScore,
        scoreType: seasonWithLeagueAndRole.scoreType,
        closed: seasonWithLeagueAndRole.closed,
      },
      role: seasonWithLeagueAndRole.role,
    },
  });
});

const leagueEditorAccessMiddleware = isAuthed
  .unstable_pipe(leagueAccessMiddleware)
  .unstable_pipe(async ({ ctx, next }) => {
    if (!editorRoles.includes(ctx.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({
      ctx: {
        ...ctx,
      },
    });
  });

export const leagueProcedure = t.procedure
  .input(z.object({ leagueSlug: z.string().min(1) }))
  .use(leagueAccessMiddleware);

export const seasonProcedure = t.procedure
  .input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
  .use(seasonAccessMiddleware);

export const leagueEditorProcedure = t.procedure
  .input(z.object({ leagueSlug: z.string().min(1) }))
  .use(leagueEditorAccessMiddleware);

export const protectedProcedure = t.procedure.use(isAuthed);
