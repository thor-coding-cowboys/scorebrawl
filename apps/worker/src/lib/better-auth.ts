import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { type DB, drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "../lib/password";
import { createAccessControl } from "better-auth/plugins/access";
import { eq, and, or, gt, isNull } from "drizzle-orm";
import { player, season, seasonPlayer } from "../db/schema";
import { createId } from "../utils/id-util";

import { defaultStatements, adminAc } from "better-auth/plugins/organization/access";

const statement = {
	...defaultStatements,
	match: ["create", "update", "delete"],
} as const;

const ac = createAccessControl(statement);

const owner = ac.newRole({
	...adminAc.statements,
	match: ["create", "update", "delete"],
});

const editor = ac.newRole({
	...adminAc.statements,
	match: ["create", "update", "delete"],
});

const member = ac.newRole({
	match: ["create", "update", "delete"],
});

const viewer = ac.newRole({
	match: [],
});

export function createAuth({
	db,
	betterAuthSecret,
	githubClientId,
	githubClientSecret,
	googleClientId,
	googleClientSecret,
	origin,
	resendApiKey,
}: {
	db: DB;
	betterAuthSecret: string;
	githubClientId?: string;
	githubClientSecret?: string;
	googleClientId?: string;
	googleClientSecret?: string;
	origin?: string;
	resendApiKey?: string;
}) {
	const hasAnySocialProviders =
		(githubClientId && githubClientSecret) || (googleClientId && googleClientSecret);

	// Determine rpID and origin for passkey
	const getRpID = (originUrl?: string) => {
		if (originUrl) {
			try {
				const url = new URL(originUrl);
				return url.hostname;
			} catch {
				return "localhost";
			}
		}
		return "localhost";
	};

	const passkeyOrigin = !(origin?.includes("127.0.0.1") || origin?.includes("localhost"))
		? origin
		: "http://localhost:5173";
	const rpID = getRpID(passkeyOrigin);

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		secret: betterAuthSecret,
		emailAndPassword: {
			enabled: true,
			password: {
				hash: async (password) => {
					return await hashPassword(password);
				},
				verify: async ({ password, hash }) => {
					return await verifyPassword(hash, password);
				},
			},
		},
		socialProviders: hasAnySocialProviders
			? {
					github:
						githubClientId && githubClientSecret
							? {
									enabled: true,
									clientId: githubClientId,
									clientSecret: githubClientSecret,
								}
							: undefined,
					google:
						googleClientId && googleClientSecret
							? {
									enabled: true,
									clientId: googleClientId,
									clientSecret: googleClientSecret,
								}
							: undefined,
				}
			: undefined,
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ["google", "email-password", "github"],
			},
		},
		plugins: [
			organization({
				ac,
				roles: {
					owner,
					editor,
					member,
					viewer,
				},
				teams: { enabled: true },
				schema: {
					organization: {
						modelName: "league",
					},
				},
				organizationHooks: {
					afterAcceptInvitation: async ({ invitation, member: _member, user }) => {
						// Skip for viewer role
						if (invitation.role === "viewer") {
							return;
						}

						const now = new Date();

						// Insert into player table
						const playerId = createId();
						await db.insert(player).values({
							id: playerId,
							userId: user.id,
							organizationId: invitation.organizationId,
							disabled: false,
							createdAt: now,
							updatedAt: now,
						});

						// Find future or ongoing seasons
						const ongoingAndFutureSeasons = await db
							.select({ id: season.id, initialScore: season.initialScore })
							.from(season)
							.where(
								and(
									eq(season.organizationId, invitation.organizationId),
									or(gt(season.endDate, now), isNull(season.endDate))
								)
							);

						// Insert into seasonPlayer for each ongoing season
						if (ongoingAndFutureSeasons.length > 0) {
							await db.insert(seasonPlayer).values(
								ongoingAndFutureSeasons.map((s: { id: string; initialScore: number }) => ({
									id: createId(),
									seasonId: s.id,
									playerId,
									score: s.initialScore,
									disabled: false,
									createdAt: now,
									updatedAt: now,
								}))
							);
						}
					},
				},
				async sendInvitationEmail(data, _request) {
					const { Resend } = await import("resend");
					const { email, organization, invitation } = data;
					const invitationAcceptLink = `${origin}/accept-invitation/${invitation.id}`;
					if (!resendApiKey) {
						console.log("Resend API key not provided. Cannot send invitation email.");
						console.log(`Invitation link for ${email}: ${invitationAcceptLink}`);
						return;
					}

					// Send email using Resend
					const resend = new Resend(resendApiKey || "");
					await resend.emails.send({
						from: "no-reply@scorebrawl.com",
						to: email,
						subject: `Invitation to join ${organization.name} on Scorebrawl`,
						html: `
							<p>You have been invited to join the organization <strong>${organization.name}</strong> on Scorebrawl.</p>
							<p>Click the link below to accept the invitation:</p>
							<p><a href="${invitationAcceptLink}">Join ${organization.name}</a></p>
							<p>If you did not expect this invitation, you can safely ignore this email.</p>
						`,
					});
					console.log(`Invitation for organization ${organization.name} sent to ${email}`);
				},
			}),
			passkey({
				rpID,
				rpName: "Scorebrawl",
				origin: passkeyOrigin,
			}),
		],
	});
}
