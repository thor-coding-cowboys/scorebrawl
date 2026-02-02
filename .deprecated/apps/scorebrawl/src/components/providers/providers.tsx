"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";
import { useRouter } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Provider as BalancerProvider } from "react-wrap-balancer";

export const Providers = ({ children, ...props }: ThemeProviderProps) => {
  const router = useRouter();
  return (
    <NextThemesProvider {...props}>
      <BalancerProvider>
        <TooltipProvider>
          <NuqsAdapter>
            <AuthUIProvider
              authClient={authClient}
              navigate={router.push}
              replace={router.replace}
              social={{ providers: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? ["google"] : [] }}
              credentials={env.NEXT_PUBLIC_ENABLE_USERNAME_PASSWORD}
              onSessionChange={() => router.refresh()}
              redirectTo="/"
            >
              {children}
            </AuthUIProvider>
          </NuqsAdapter>
        </TooltipProvider>
      </BalancerProvider>
    </NextThemesProvider>
  );
};
