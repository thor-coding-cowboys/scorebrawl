import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware/context";

const app = new Hono<HonoEnv>();

// Validation schema for the key parameter
const keyParamSchema = z.object({
	key: z.string().min(1, "Key is required"),
});

// Serve any asset by key with authentication
// URL format: /api/user-assets/{key}
// Examples:
//   /api/user-assets/user/abc/avatars/123.png
//   /api/user-assets/organization/xyz/logos/456.png
app.get("/:key{.*}", zValidator("param", keyParamSchema), async (c) => {
	const auth = c.get("authentication");
	if (!auth?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	// Get validated key from params
	const key = c.req.param("key");
	const bucket = c.get("userAssets").bucket;

	// If it's an external URL (full http/https URL stored in DB), redirect to it
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return c.redirect(key);
	}

	// Security check: verify user can access this key
	// User can only access their own avatars or logos from orgs they belong to
	const userId = auth.user.id;
	const isUserAvatar = key.startsWith(`user/${userId}/`);

	// For organization assets, check if user is a member
	let isOrgLogo = false;
	if (key.startsWith("organization/")) {
		// Extract organization ID from key (format: organization/{orgId}/logos/{filename})
		const match = key.match(/^organization\/([^/]+)\//);
		if (match) {
			const orgId = match[1];
			const db = c.get("db");
			const { member } = await import("../db/schema/auth-schema");
			const { and, eq } = await import("drizzle-orm");

			const membership = await db
				.select({ id: member.id })
				.from(member)
				.where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
				.limit(1);

			isOrgLogo = membership.length > 0;
		}
	}

	if (!isUserAvatar && !isOrgLogo) {
		return c.json({ error: "Forbidden" }, 403);
	}

	try {
		const object = await bucket.get(key);

		if (!object) {
			return c.json({ error: "Asset not found" }, 404);
		}

		// Set appropriate headers
		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("etag", object.httpEtag);
		headers.set("cache-control", "private, max-age=3600");

		return new Response(object.body, { headers });
	} catch (error) {
		console.error("Error serving asset:", error);
		return c.json({ error: "Failed to serve asset" }, 500);
	}
});

export default app;
