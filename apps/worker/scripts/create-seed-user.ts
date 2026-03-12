#!/usr/bin/env bun
/**
 * Create the seed user via the auth API.
 * This ensures proper password hashing and user creation through better-auth.
 */

const SEED_USER = {
	email: "seed@scorebrawl.com",
	password: "Test.1234",
	name: "Seed User",
};

const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;

async function main() {
	const previewUrl = process.env.PREVIEW_URL;
	if (!previewUrl) {
		console.error(red("Error: PREVIEW_URL environment variable must be set"));
		process.exit(1);
	}

	console.log(cyan("Creating seed user via auth API..."));
	console.log("Email:", SEED_USER.email);

	const response = await fetch(`${previewUrl}/api/auth/sign-up/email`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: SEED_USER.email,
			password: SEED_USER.password,
			name: SEED_USER.name,
		}),
	});

	const result = await response.json();

	if (!response.ok) {
		// User might already exist
		if (result.error?.message?.includes("exists")) {
			console.log(green("Seed user already exists"));

			// Try to sign in to get the user ID
			const signInResponse = await fetch(`${previewUrl}/api/auth/sign-in/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: SEED_USER.email,
					password: SEED_USER.password,
				}),
			});

			if (signInResponse.ok) {
				const signInResult = (await signInResponse.json()) as { user?: { id: string } };
				if (signInResult.user?.id) {
					console.log(green(`User ID: ${signInResult.user.id}`));
					// Output for GitHub Actions
					console.log(`::set-output name=user_id::${signInResult.user.id}`);
					process.stdout.write(signInResult.user.id);
					return;
				}
			}

			console.error(red("Could not get existing user ID"));
			process.exit(1);
		}

		console.error(red("Failed to create seed user:"), result);
		process.exit(1);
	}

	const userId = (result as { user?: { id: string } }).user?.id;
	if (!userId) {
		console.error(red("User created but no ID returned"));
		process.exit(1);
	}

	console.log(green(`Seed user created successfully!`));
	console.log(green(`User ID: ${userId}`));

	// Output for GitHub Actions
	console.log(`::set-output name=user_id::${userId}`);
	process.stdout.write(userId);
}

main().catch((error) => {
	console.error(red("Error:"), error);
	process.exit(1);
});
