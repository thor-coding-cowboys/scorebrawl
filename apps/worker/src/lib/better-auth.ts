import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { type DB, drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "../lib/password";

export function createAuth({
	db,
	betterAuthSecret,
	githubClientId,
	githubClientSecret,
	googleClientId,
	googleClientSecret,
	origin,
}: {
	db: DB;
	betterAuthSecret: string;
	githubClientId?: string;
	githubClientSecret?: string;
	googleClientId?: string;
	googleClientSecret?: string;
	origin?: string;
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
			organization({ teams: { enabled: true } }),
			passkey({
				rpID,
				rpName: "Scorebrawl",
				origin: passkeyOrigin,
			}),
		],
	});
}
