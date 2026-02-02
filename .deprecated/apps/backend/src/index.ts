import { claim, findByCode } from "@scorebrawl/database/repositories/invite-repository";
import { getByIdWhereMember } from "@scorebrawl/database/repositories/league-repository";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { handleTRPC } from "./trpc";

const app = new Hono();

// CORS for frontend
app.use(
  "/*",
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  }),
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Better-auth routes
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// Auto-join league route
app.get("/api/leagues/auto-join/:code", async (c) => {
  const code = c.req.param("code");
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  // Find the invite
  const invite = await findByCode(code);
  if (!invite) {
    return c.redirect(`${frontendUrl}/?errorCode=INVITE_NOT_FOUND`);
  }

  // Check if expired
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return c.redirect(`${frontendUrl}/?errorCode=INVITE_EXPIRED`);
  }

  // Get session
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    // Redirect to sign in with return URL (frontend URL since it proxies /api to backend)
    const redirectUrl = `${frontendUrl}/api/leagues/auto-join/${code}`;
    return c.redirect(`${frontendUrl}/auth/sign-in?redirect=${encodeURIComponent(redirectUrl)}`);
  }

  // Check if already a member
  const league = await getByIdWhereMember({
    leagueId: invite.leagueId,
    userId: session.user.id,
  });

  if (league) {
    return c.redirect(`${frontendUrl}/leagues/${league.slug}?errorCode=INVITE_ALREADY_CLAIMED`);
  }

  // Claim the invite
  try {
    const { leagueSlug } = await claim({
      leagueId: invite.leagueId,
      role: invite.role,
      userId: session.user.id,
    });

    return c.redirect(`${frontendUrl}/leagues/${leagueSlug}`);
  } catch (err) {
    console.error("Error claiming invite:", err);
    return c.redirect(`${frontendUrl}/?errorCode=INVITE_CLAIM_FAILED`);
  }
});

// tRPC routes
app.all("/api/trpc/*", handleTRPC);

const port = process.env.PORT || 3001;

export default {
  port,
  fetch: app.fetch,
};
