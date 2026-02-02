import { AppSidebar } from "@/components/app-sidebar";
import { ErrorToast } from "@/components/error-toast";
import { SiteFooter } from "@/components/layout/site-footer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { api } from "@/trpc/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
export const dynamic = "force-dynamic";
interface LayoutProps {
  children: ReactNode;
}

export default async function Layout({ children }: LayoutProps) {
  await auth.api.getSession({
    headers: await headers(),
  });
  const leagues = await api.league.getAll({});
  return (
    <SidebarProvider>
      <AppSidebar leagues={leagues} />
      <SidebarInset className="h-full">
        <main className="flex-1 container relative flex flex-col">{children}</main>
        <SiteFooter />
        <ErrorToast />
      </SidebarInset>
    </SidebarProvider>
  );
}
