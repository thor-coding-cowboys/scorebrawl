import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AdminSidebar } from "./-components/admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { fetchSessionForRoute } from "@/hooks/useSession";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/admin")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);
		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}

		const { error } = await authClient.admin.listUsers({ query: { limit: 1 } });
		if (error) {
			console.log("HEEYJA,", error);
			// throw redirect({ to: "/" });
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
