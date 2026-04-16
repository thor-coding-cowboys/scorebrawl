import type { TRPCRouter } from "@coding-cowboys/scorebrawl-worker/trpc";
import { createTRPCClient, httpLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

export const { TRPCProvider, useTRPC } = createTRPCContext<TRPCRouter>();

export type RouterOutput = inferRouterOutputs<TRPCRouter>;

export const trpcClient = createTRPCClient<TRPCRouter>({
	links: [
		splitLink({
			condition: (op) => op.type === "subscription",
			true: httpSubscriptionLink({
				transformer: superjson,
				url: "/api/trpc",
			}),
			false: httpLink({
				transformer: superjson,
				url: "/api/trpc",
			}),
		}),
	],
});

export type TRPCClient = typeof trpcClient;

export type SessionRouter = TRPCRouter["session"];

export function createSessionQueryKey(sessionId: string) {
	return ["session", sessionId] as const;
}

// biome-ignore lint: escape hatch for tRPC route type inference gaps in Cloudflare Workers
export type AnyTRPC = any;
