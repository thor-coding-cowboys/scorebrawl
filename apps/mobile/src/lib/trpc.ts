import type { RouterOutputOf } from "@coding-cowboys/scorebrawl-client/trpc";
import type { TRPCRouter } from "@coding-cowboys/scorebrawl-worker/trpc";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import { AUTH_BASE_URL, getAuthCookie } from "./auth-client";

export const { TRPCProvider, useTRPC } = createTRPCContext<TRPCRouter>();

export type RouterOutput = RouterOutputOf<TRPCRouter>;

export const trpcClient = createTRPCClient<TRPCRouter>({
	links: [
		httpLink({
			transformer: superjson,
			url: `${AUTH_BASE_URL}/api/trpc`,
			headers: async () => {
				const cookie = await getAuthCookie();
				return cookie ? { cookie } : {};
			},
			fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
		}),
	],
});
