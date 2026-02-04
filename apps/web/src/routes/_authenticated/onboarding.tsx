import { Header } from "@/components/layout/header";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

const organizationsQueryOptions = () => ({
	queryKey: ["auth", "organizations"],
	queryFn: async () => {
		const { data, error } = await authClient.organization.list({});
		if (error) {
			throw error;
		}
		return data ?? [];
	},
});

export const Route = createFileRoute("/_authenticated/onboarding")({
	component: OnboardingPage,
});

function OnboardingPage() {
	const { data: organizations, isPending } = useQuery(organizationsQueryOptions());
	const navigate = useNavigate();

	useEffect(() => {
		if (isPending) return;
		if (organizations && organizations.length > 0) {
			navigate({ to: "/" });
		}
	}, [organizations, isPending, navigate]);

	if (isPending || (organizations && organizations.length > 0)) {
		return null;
	}

	return (
		<>
			<Header includeLogoutButton={true} />
			<Outlet />
		</>
	);
}
