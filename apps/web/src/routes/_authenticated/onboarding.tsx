import { Header } from "@/components/layout/header";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/onboarding")({
	component: OnboardingPage,
});

function OnboardingPage() {
	return (
		<>
			<Header includeLogoutButton={true} />
			<Outlet />
		</>
	);
}
