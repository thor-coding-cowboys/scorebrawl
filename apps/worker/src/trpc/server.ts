import { trpcServer as honoTrpcServer } from "@hono/trpc-server";
import type { Context } from "hono";
import type { HonoEnv } from "../middleware/context";
import { trpcRouter } from "./trpc-router";

export const trpcServer = honoTrpcServer({
	router: trpcRouter,
	createContext: async (_opts, c: Context<HonoEnv>) => {
		const betterAuth = c.get("betterAuth");
		const authentication = await betterAuth.api.getSession({
			headers: c.req.raw.headers,
		});
		return {
			authentication,
			db: c.get("db"),
			betterAuth,
			userAssets: c.get("userAssets"),
			env: c.env,
		};
	},
});
