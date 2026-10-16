import { eq } from "drizzle-orm";
import { z } from "zod";
import { user } from "../../../db/schema/auth-schema";
import { defineTool, jsonResult } from "../tool";

export const whoamiTool = defineTool({
	name: "whoami",
	title: "Who am I",
	description: "Identify the Scorebrawl account this MCP connection is signed in as.",
	inputSchema: z.object({}),
	async execute(_input, { db, claims }) {
		const userId = claims.sub;
		if (!userId) {
			return jsonResult({
				clientId: claims.client_id ?? null,
				message: "Not acting on behalf of a Scorebrawl user.",
			});
		}
		const [account] = await db
			.select({ id: user.id, email: user.email, name: user.name })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		return jsonResult(account ?? { message: "The authenticated user no longer exists." });
	},
});
