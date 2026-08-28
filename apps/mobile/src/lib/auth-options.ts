export const isEmailPasswordEnabled = process.env.EXPO_PUBLIC_DISABLE_EMAIL_PASSWORD !== "true";

export const isGithubEnabled = Boolean(process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID);

export const isGoogleEnabled = Boolean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
