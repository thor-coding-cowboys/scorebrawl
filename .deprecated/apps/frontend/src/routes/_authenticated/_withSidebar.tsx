import { AppSidebar } from "@/components/app-sidebar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { trpc } from "@/lib/trpc";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_withSidebar")({
  component: WithSidebarLayout,
});

function WithSidebarLayout() {
  const { data: leagues } = trpc.league.getAll.useQuery();

  return (
    <SidebarProvider>
      <AppSidebar leagues={leagues || []} />
      <SidebarInset className="flex flex-col h-full">
        <div className="flex-1 flex flex-col">
          <Outlet />
        </div>
        <SiteFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
