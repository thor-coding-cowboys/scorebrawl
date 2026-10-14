import type { TRPCClient } from "@trpc/client";
import type { AnyRouter, inferRouterOutputs } from "@trpc/server";

export type RouterOutputOf<TRouter extends AnyRouter> = inferRouterOutputs<TRouter>;

export type TRPCClientOf<TRouter extends AnyRouter> = TRPCClient<TRouter>;
