import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { type DB, drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, apiKey } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "../lib/password";
import { createAccessControl } from "better-auth/plugins/access";
import { afterAcceptInvitation, afterCreateOrganization } from "./better-auth-organization-hooks";
import { and, eq } from "drizzle-orm";
import { userPreference } from "../db/schema/user-preferences-schema";
import { invitation, league, member as memberTable } from "../db/schema/auth-schema";
import { guest, player } from "../db/schema/league-schema";
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
	isProduction,
}: {
	db: DB;
	betterAuthSecret: string;
	githubClientId?: string;
	githubClientSecret?: string;
	googleClientId?: string;
	googleClientSecret?: string;
	origin?: string;
	resendApiKey?: string;
	isProduction?: boolean;
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
		databaseHooks: {
			user: {
				create: {
					after: async (createdUser) => {
						try {
							// Check if guest records exist for this email
							const guestPlayers = await db
								.select({
									playerId: player.id,
									leagueId: player.leagueId,
									leagueName: league.name,
									guestDisplayName: guest.displayName,
								})
								.from(player)
								.innerJoin(guest, eq(player.guestId, guest.id))
								.innerJoin(league, eq(player.leagueId, league.id))
								.where(eq(guest.email, createdUser.email));

							if (guestPlayers.length === 0) return;

							for (const guestPlayer of guestPlayers) {
								// Skip if invitation already exists
								const [existingInvite] = await db
									.select({ id: invitation.id })
									.from(invitation)
									.where(
										and(
											eq(invitation.organizationId, guestPlayer.leagueId),
											eq(invitation.email, createdUser.email),
											eq(invitation.status, "pending")
										)
									)
									.limit(1);

								if (existingInvite) continue;

								// Find league owner to use as inviter
								const [leagueOwner] = await db
									.select({ userId: memberTable.userId })
									.from(memberTable)
									.where(
										and(
											eq(memberTable.organizationId, guestPlayer.leagueId),
											eq(memberTable.role, "owner")
										)
									)
									.limit(1);

								if (!leagueOwner) {
									console.error(`No owner found for league ${guestPlayer.leagueId}`);
									continue;
								}

								const invitationId = createId();
								await db.insert(invitation).values({
									id: invitationId,
									organizationId: guestPlayer.leagueId,
									email: createdUser.email,
									role: "member",
									status: "pending",
									expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
									createdAt: new Date(),
									inviterId: leagueOwner.userId,
								});

								// Send email notification
								if (resendApiKey) {
									try {
										const { Resend } = await import("resend");
										const resend = new Resend(resendApiKey);
										const invitationAcceptLink = `${origin}/accept-invitation/${invitationId}`;

										await resend.emails.send({
											from: "no-reply@scorebrawl.com",
											to: createdUser.email,
											subject: `Claim your profile in ${guestPlayer.leagueName}`,
											html: `
												<p>Hi ${createdUser.name},</p>
												<p>You've been participating in <strong>${guestPlayer.leagueName}</strong> as a guest player (${guestPlayer.guestDisplayName}).</p>
												<p>Now that you've created an account, you can claim your profile!</p>
												<p><a href="${invitationAcceptLink}">Claim Profile</a></p>
												<p>Your stats and match history will be preserved.</p>
											`,
										});
									} catch (e) {
										console.error("Failed to send guest claim email:", e);
									}
								} else {
									const invitationAcceptLink = `${origin}/accept-invitation/${invitationId}`;
									console.log(
										`Guest claim invitation for ${createdUser.email} in ${guestPlayer.leagueName}: ${invitationAcceptLink}`
									);
								}
							}
						} catch (e) {
							console.error("Failed to check guest records on user signup:", e);
						}
					},
				},
			},
			session: {
				create: {
					before: async (session) => {
						if (session.activeOrganizationId) {
							return;
						}
						const [prefs] = await db
							.select({ lastActiveOrganizationId: userPreference.lastActiveOrganizationId })
							.from(userPreference)
							.where(eq(userPreference.userId, session.userId))
							.limit(1);
						if (prefs?.lastActiveOrganizationId) {
							return {
								data: {
									...session,
									activeOrganizationId: prefs.lastActiveOrganizationId,
								},
							};
						}
					},
				},
				update: {
					after: async (session) => {
						if (session.activeOrganizationId) {
							await db
								.insert(userPreference)
								.values({
									userId: session.userId,
									lastActiveOrganizationId: session.activeOrganizationId,
									createdAt: new Date(),
									updatedAt: new Date(),
								})
								.onConflictDoUpdate({
									target: userPreference.userId,
									set: {
										lastActiveOrganizationId: session.activeOrganizationId,
										updatedAt: new Date(),
									},
								});
						}
					},
				},
			},
		},
		emailAndPassword: {
			enabled: process.env.DISABLE_EMAIL_PASSWORD?.toLowerCase() !== "true",
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
				schema: {
					organization: {
						modelName: "league",
					},
				},
				organizationHooks: {
					afterAcceptInvitation: async (params) => {
						await afterAcceptInvitation({ ...params, db });
					},
					afterCreateOrganization: async (params) => {
						await afterCreateOrganization({ ...params, db });
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
			apiKey({
				defaultPrefix: isProduction ? "sb_live" : "sb_dev",
				enableMetadata: true,
				enableSessionForAPIKeys: true,
				rateLimit: {
					enabled: true,
					maxRequests: 10000,
					timeWindow: 1000 * 60 * 60 * 24,
				},
			}),
		],
	});
}
