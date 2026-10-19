import type { JWTPayload } from "jose";
import type { getDb } from "../../db";

export type McpAccessTokenClaims = JWTPayload & {
	sub?: string;
	scope?: string;
	client_id?: string;
};

export type McpToolContext = {
	db: ReturnType<typeof getDb>;
	claims: McpAccessTokenClaims;
};
