import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "../middleware/context";

export const userAssetsRouter = new Hono<HonoEnv>().get("/:key{.*}", async (c) => {
	const auth = c.get("authentication");
	if (!auth?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const key = c.req.param("key");
	if (!key) {
		throw new HTTPException(400, { message: "Key is required" });
	}

	const bucket = c.get("userAssets").bucket;

	// If it's an external URL (full http/https URL stored in DB), redirect to it
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return c.redirect(key);
	}

	// Security check: verify user can access this key
	// User can access:
	// 1. Their own avatars
	// 2. Logos from orgs they belong to or have pending invitations for
	// 3. Avatars of users who invited them (for pending invitations)
	const userId = auth.user.id;
	const isUserAvatar = key.startsWith(`user/${userId}/`);

	// Check if this is an inviter's avatar (for pending invitations)
	let isInviterAvatar = false;
	if (key.startsWith("user/") && !isUserAvatar) {
		const inviterIdMatch = key.match(/^user\/([^/]+)\//);
		if (inviterIdMatch) {
			const potentialInviterId = inviterIdMatch[1];
			const db = c.get("db");
			const { invitation } = await import("../db/schema/auth-schema");
			const { and, eq } = await import("drizzle-orm");

			const inviterCheck = await db
				.select({ id: invitation.id })
				.from(invitation)
				.where(
					and(
						eq(invitation.email, auth.user.email),
						eq(invitation.inviterId, potentialInviterId),
						eq(invitation.status, "pending")
					)
				)
				.limit(1);

			isInviterAvatar = inviterCheck.length > 0;
		}
	}

	// For organization assets, check if user is a member or has a pending invitation
	let isOrgLogo = false;
	if (key.startsWith("organization/")) {
		// Extract organization ID from key (format: organization/{orgId}/logos/{filename})
		const match = key.match(/^organization\/([^/]+)\//);
		if (match) {
			const orgId = match[1];
			const db = c.get("db");
			const { member, invitation } = await import("../db/schema/auth-schema");
			const { and, eq } = await import("drizzle-orm");

			// Check if user is a member OR has a pending invitation
			const [membership, pendingInvitation] = await Promise.all([
				db
					.select({ id: member.id })
					.from(member)
					.where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
					.limit(1),
				db
					.select({ id: invitation.id })
					.from(invitation)
					.where(
						and(
							eq(invitation.organizationId, orgId),
							eq(invitation.email, auth.user.email),
							eq(invitation.status, "pending")
						)
					)
					.limit(1),
			]);

			isOrgLogo = membership.length > 0 || pendingInvitation.length > 0;
		}
	}

	if (!isUserAvatar && !isOrgLogo && !isInviterAvatar) {
		return c.json({ error: "Forbidden" }, 403);
	}

	try {
		const object = await bucket.get(key);

		if (!object) {
			return c.json({ error: "Asset not found" }, 404);
		}

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
