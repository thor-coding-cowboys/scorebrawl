import { Header } from "@/components/layout/header";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/onboarding")({
	component: OnboardingPage,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.data?.session) {
			throw redirect({ to: "/" });
		}
	},
});

function OnboardingPage() {
	return (
		<>
			<Header includeLogoutButton={true} />
			<Outlet />
		</>
	);
}
