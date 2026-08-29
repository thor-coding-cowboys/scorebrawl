import type { TRPCRouter } from "@coding-cowboys/scorebrawl-worker/trpc";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import { AUTH_BASE_URL, getAuthCookie } from "./auth-client";

export const { TRPCProvider, useTRPC } = createTRPCContext<TRPCRouter>();

export type RouterOutput = inferRouterOutputs<TRPCRouter>;

export const trpcClient = createTRPCClient<TRPCRouter>({
	links: [
		httpLink({
			transformer: superjson,
			url: `${AUTH_BASE_URL}/api/trpc`,
			headers: async () => {
				const cookie = await getAuthCookie();
				return cookie ? { cookie } : {};
			},
		}),
	],
});
