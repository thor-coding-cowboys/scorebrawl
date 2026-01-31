import { createDb } from "@scorebrawl/database";
import { type TRPCContext, appRouter } from "@scorebrawl/trpc";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { Context } from "hono";
import { auth } from "./auth";

export async function handleTRPC(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: (): TRPCContext => ({
      headers: c.req.raw.headers,
      session,
      db: createDb(),
    }),
  });
}
