import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { fetchSessionForRoute } from "@/hooks/useSession";

export const Route = createFileRoute("/_auth")({
	component: LayoutComponent,
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);
		if (session?.session) {
			throw redirect({ to: "/" });
		}
	},
});

function LayoutComponent() {
	return (
		<div className="flex min-h-screen w-full flex-col">
			<div className="flex h-16 items-center justify-end border-b px-4">
				<ThemeSwitcher />
			</div>
			<div className="flex flex-1 items-center justify-center p-4">
				<Outlet />
			</div>
			<Toaster position="bottom-right" />
		</div>
	);
}
