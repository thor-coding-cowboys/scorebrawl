import { expo } from "@better-auth/expo";
import { passkey as passkeyPlugin } from "@better-auth/passkey";
import { mcp } from "@better-auth/mcp";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { type DB, drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	type GenericOAuthConfig,
	genericOAuth,
	organization,
	admin,
	bearer,
	deviceAuthorization,
	jwt,
} from "better-auth/plugins";
import * as schema from "../db/schema";
import { createAccessControl } from "better-auth/plugins/access";
import { afterAcceptInvitation, afterCreateOrganization } from "./better-auth-organization-hooks";
import { and, eq } from "drizzle-orm";
import { userPreference } from "../db/schema/user-preferences-schema";
import { invitation, league, member as memberTable } from "../db/schema/auth-schema";
import { guest, player } from "../db/schema/league-schema";
import { createId } from "../utils/id-util";
import { buildPasskeyConfig, type PasskeyConfig } from "./passkey-config";

export const PERSONAL_API_KEY_CONFIG_ID = "personal";

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

export type EmulateProviders = {
	googleUrl?: string;
	githubUrl?: string;
};

/**
 * Social providers backed by the in-Worker emulator instead of the real
 * upstreams. Only used when `EMULATE_*_URL` is set (dev, e2e, previews), so
 * production keeps the built-in providers.
 */
function emulatedSocialProviders({
	emulate,
	githubClientId,
	githubClientSecret,
	googleClientId,
	googleClientSecret,
}: {
	emulate: EmulateProviders;
	githubClientId?: string;
	githubClientSecret?: string;
	googleClientId?: string;
	googleClientSecret?: string;
}): GenericOAuthConfig[] {
	const configs: GenericOAuthConfig[] = [];
	const { googleUrl, githubUrl } = emulate;

	if (googleUrl && googleClientId && googleClientSecret) {
		configs.push({
			providerId: "google",
			name: "Google",
			clientId: googleClientId,
			clientSecret: googleClientSecret,
			authorizationUrl: `${googleUrl}/o/oauth2/v2/auth`,
			scopes: ["openid", "email", "profile"],
			pkce: true,
			// The emulator runs in this Worker (apps/worker/src/emulate), so the
			// callback exchanges the code in-process. No Worker-to-itself fetch:
			// that would depend on loop-back routing and local TLS trust, which is
			// exactly what previews cannot guarantee.
			getToken: async ({ code }) => {
				const { exchangeEmulatedCode } = await import("../emulate");
				const tokens = exchangeEmulatedCode("google", code);
				if (!tokens) throw new Error("Invalid emulated Google authorization code");
				return {
					accessToken: tokens.accessToken,
					accessTokenExpiresAt: tokens.expiresAt,
					scopes: tokens.scopes,
					tokenType: "Bearer",
				};
			},
			getUserInfo: async (tokens) => {
				const { emulatedTokenProfile } = await import("../emulate");
				const profile = emulatedTokenProfile(tokens.accessToken);
				if (!profile) return null;
				return {
					id: profile.email,
					email: profile.email,
					emailVerified: profile.emailVerified,
					name: profile.name,
					image: undefined,
				};
			},
		});
	}

	if (githubUrl && githubClientId && githubClientSecret) {
		configs.push({
			providerId: "github",
			name: "GitHub",
			clientId: githubClientId,
			clientSecret: githubClientSecret,
			authorizationUrl: `${githubUrl}/login/oauth/authorize`,
			scopes: ["read:user", "user:email"],
			getToken: async ({ code }) => {
				const { exchangeEmulatedCode } = await import("../emulate");
				const tokens = exchangeEmulatedCode("github", code);
				if (!tokens) throw new Error("Invalid emulated GitHub authorization code");
				return {
					accessToken: tokens.accessToken,
					accessTokenExpiresAt: tokens.expiresAt,
					scopes: tokens.scopes,
					tokenType: "bearer",
				};
			},
			getUserInfo: async (tokens) => {
				const { emulatedTokenProfile } = await import("../emulate");
				const profile = emulatedTokenProfile(tokens.accessToken);
				if (!profile) return null;
				return {
					id: profile.id,
					email: profile.email,
					emailVerified: profile.emailVerified,
					name: profile.name,
					image: undefined,
				};
			},
		});
	}

	return configs;
}

export function createAuth({
	db,
	betterAuthSecret,
	githubClientId,
	githubClientSecret,
	googleClientId,
	googleClientSecret,
	origin,
	resendApiKey,
	adminUserIds,
	oauthResource,
	passkey,
	mcpResource,
	baseURL,
	emulate,
}: {
	db: DB;
	betterAuthSecret: string;
	githubClientId?: string;
	githubClientSecret?: string;
	googleClientId?: string;
	googleClientSecret?: string;
	origin?: string;
	resendApiKey?: string;
	adminUserIds?: string[];
	oauthResource?: string;
	passkey?: PasskeyConfig;
	mcpResource?: string;
	baseURL?: string;
	/** Set only for local dev / e2e: routes social providers to `emulate`. */
	emulate?: EmulateProviders;
}) {
	const emulatedProviders = emulate
		? emulatedSocialProviders({
				emulate,
				githubClientId,
				githubClientSecret,
				googleClientId,
				googleClientSecret,
			})
		: [];
	const isEmulated = (provider: "github" | "google") =>
		emulatedProviders.some((entry) => entry.providerId === provider);
	const hasAnySocialProviders =
		(!isEmulated("github") && githubClientId && githubClientSecret) ||
		(!isEmulated("google") && googleClientId && googleClientSecret);

	// Only the request middleware supplies a config; tests and the better-auth
	// CLI export fall back to local dev values, matching previous behaviour.
	const passkeyConfig = passkey ?? buildPasskeyConfig({});

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema,
		}),
		secret: betterAuthSecret,
		baseURL,
		trustedOrigins: origin ? [origin, "scorebrawl://"] : undefined,
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
		// The e2e suites sign in for every spec from one IP, which trips the default
		// per-IP rate limiter. Playwright sets this flag for its runs only.
		rateLimit: process.env.DISABLE_RATE_LIMIT === "true" ? { enabled: false } : undefined,
		socialProviders: hasAnySocialProviders
			? {
					github:
						!isEmulated("github") && githubClientId && githubClientSecret
							? {
									enabled: true,
									clientId: githubClientId,
									clientSecret: githubClientSecret,
								}
							: undefined,
					google:
						!isEmulated("google") && googleClientId && googleClientSecret
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
				trustedProviders: ["google", "github"],
			},
		},
		plugins: [
			expo(),
			// Empty unless EMULATE_*_URL is set, so production registers nothing.
			genericOAuth({ config: emulatedProviders }),
			admin({ adminUserIds: adminUserIds || [] }),
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
			passkeyPlugin({
				rpID: passkeyConfig.rpID,
				rpName: "Scorebrawl",
				origin: passkeyConfig.origin,
			}),
			bearer(),
			apiKey([
				{
					configId: "default",
					references: "organization",
					defaultPrefix: "sbk_",
					startingCharactersConfig: { shouldStore: true, charactersLength: 12 },
					enableMetadata: true,
					requireName: true,
					rateLimit: { enabled: true, maxRequests: 600, timeWindow: 60_000 },
					keyExpiration: { defaultExpiresIn: null, minExpiresIn: 1, maxExpiresIn: 3650 },
				},
				{
					configId: PERSONAL_API_KEY_CONFIG_ID,
					references: "user",
					defaultPrefix: "sbp_",
					startingCharactersConfig: { shouldStore: true, charactersLength: 12 },
					enableMetadata: true,
					requireName: true,
					rateLimit: { enabled: true, maxRequests: 600, timeWindow: 60_000 },
					keyExpiration: { defaultExpiresIn: null, minExpiresIn: 1, maxExpiresIn: 3650 },
				},
			]),
			deviceAuthorization({
				verificationUri: "/device",
				schema: {},
			}),
			jwt({
				jwks: {
					// Preview deployments rotate BETTER_AUTH_SECRET on every deploy,
					// which would make encrypted private keys undecryptable (500 on
					// session lookups). Store signing keys unencrypted so secret
					// rotation never breaks token signing/verification.
					disablePrivateKeyEncryption: true,
				},
			}),
			mcp({
				loginPage: "/auth/sign-in",
				consentPage: "/consent",
				resource: mcpResource ?? `${baseURL ?? origin ?? "http://localhost"}/mcp`,
				resources: oauthResource ? [oauthResource] : [],
				scopes: [
					"openid",
					"profile",
					"email",
					"offline_access",
					"create:matches",
					"read:matches",
					"read:leagues",
					"read:seasons",
					"mcp:tools",
				],
				enforcePerClientResources: false,
				allowDynamicClientRegistration: true,
				allowUnauthenticatedClientRegistration: true,
			}),
		],
	});
}
