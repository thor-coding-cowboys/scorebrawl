import { Accounts, Sessions, Users, Verifications, db } from "@scorebrawl/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword, verifyPassword } from "./password";

// Better Auth is configured at module level with the global db export.
// This works in Cloudflare Workers because db is configured with short-lived
// connections (max: 1, idle_timeout: 1) to avoid I/O context issues.
// See packages/database/src/db.ts for the connection configuration.
export const auth = betterAuth({
  logger: {
    level: "debug",
  },
  emailAndPassword: {
    enabled: process.env.NODE_ENV === "development",
    password: {
      hash: async (password) => {
        return await hashPassword(password);
      },
      verify: async ({ password, hash }) => {
        return await verifyPassword(hash, password);
      },
    },
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
  trustedOrigins: [
    "https://scorebrawl.com",
    ...(process.env.NODE_ENV === "development" ? ["http://localhost:5173"] : []),
  ],
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
