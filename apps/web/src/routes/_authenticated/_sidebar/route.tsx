import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/_sidebar")({
	component: RouteComponent,
	beforeLoad: async () => {
		const { data: session } = await authClient.getSession();

		if (!session) {
			throw redirect({ to: "/auth/sign-in" });
		}

		return { session };
	},
});

function RouteComponent() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<Outlet />
			</SidebarInset>
			<Toaster />
		</SidebarProvider>
	);
}
