import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AdminSidebar } from "./-components/admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { fetchSessionForRoute } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/admin")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);

		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}

		return { session };
	},
});

function RouteComponent() {
	return (
		<SidebarProvider>
			<AdminSidebar />
			<SidebarInset>
				<Outlet />
			</SidebarInset>
			<Toaster />
		</SidebarProvider>
	);
}
