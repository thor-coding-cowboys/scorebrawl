import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { type Session, auth } from "@/lib/auth";
import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const hdrs = new Headers(await headers());
  hdrs.set("x-trpc-source", "rsc");
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    throw Error("no session");
  }
  return createTRPCContext({
    headers: hdrs,
    auth: session as Session,
  });
});

export const api = createCaller(createContext);
