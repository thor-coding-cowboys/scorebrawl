import { Accounts, Sessions, Users, Verifications, db } from "@scorebrawl/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  logger: {
    level: "debug",
  },
  emailAndPassword: {
    enabled: process.env.NODE_ENV === "development",
  },
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
  session: {
    expiresIn: 3600 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    },
  },
  trustedOrigins: ["http://localhost:3000"],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"],
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: Users,
      account: Accounts,
      session: Sessions,
      verification: Verifications,
    },
  }),
});

export type Session = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  };
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    image?: string;
  };
};
