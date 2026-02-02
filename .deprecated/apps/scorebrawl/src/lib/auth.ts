import { betterAuth } from "better-auth";

import { Accounts, Sessions, Users, Verifications, db } from "@/db";
import { env } from "@/env";
import { checkout, polar } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

const polarClient = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: process.env.VERCEL ? "production" : "sandbox",
});

export const auth = betterAuth({
  plugins: [
    nextCookies(),
    ...(env.NEXT_PUBLIC_BUY_ME_A_COFFEE_PRODUCT_ID
      ? [
          polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
              checkout({
                products: [
                  {
                    productId: env.NEXT_PUBLIC_BUY_ME_A_COFFEE_PRODUCT_ID,
                    slug: "Coffee", // Custom slug for easy reference in Checkout URL, e.g. /checkout/Coffee
                  },
                ],
                successUrl: env.POLAR_SUCCESS_URL,
                authenticatedUsersOnly: true,
              }),
            ],
          }),
        ]
      : []),
  ],
  logger: {
    level: "debug",
  },
  emailAndPassword: {
    enabled:
      process.env.NEXT_PUBLIC_ENABLE_USERNAME_PASSWORD === "true" ||
      process.env.NODE_ENV === "development",
  },
  socialProviders:
    env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
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
  trustedOrigins: process.env.VERCEL_URL ? [process.env.VERCEL_URL] : ["http://localhost:3000"],
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
