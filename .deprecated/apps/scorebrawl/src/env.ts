import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.string().optional().default("production"),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    DATABASE_URL: z.string(),
    BETTER_AUTH_SECRET: z.string().min(1),
    DEBUG: z.string().min(8).optional(),
    POLAR_SUCCESS_URL: z.string().url(),
    POLAR_ACCESS_TOKEN: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_ENABLE_USERNAME_PASSWORD: z.coerce.boolean().default(false),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_BUY_ME_A_COFFEE_PRODUCT_ID: z.string().min(1).optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_ENABLE_USERNAME_PASSWORD: process.env.NEXT_PUBLIC_ENABLE_USERNAME_PASSWORD,
    NEXT_PUBLIC_BUY_ME_A_COFFEE_PRODUCT_ID: process.env.NEXT_PUBLIC_BUY_ME_A_COFFEE_PRODUCT_ID,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    DEBUG: process.env.DEBUG,
    POLAR_SUCCESS_URL: process.env.POLAR_SUCCESS_URL,
    POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
