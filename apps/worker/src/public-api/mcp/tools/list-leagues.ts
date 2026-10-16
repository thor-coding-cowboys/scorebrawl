import { z } from "zod";
import { defineTool, jsonResult } from "../tool";
import { leaguesForUser } from "./with-league";

export const listLeaguesTool = defineTool({
	name: "list_leagues",
	title: "List leagues",
	description:
		"List the Scorebrawl leagues this connection can query, with the slug to pass as the `league` argument to other tools.",
	inputSchema: z.object({}),
	async execute(_input, ctx) {
		return jsonResult(await leaguesForUser(ctx));
	},
});
