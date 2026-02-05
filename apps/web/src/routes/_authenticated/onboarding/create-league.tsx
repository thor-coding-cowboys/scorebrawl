import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateLeagueForm } from "@/components/leagues/create-league-form";
import { Header } from "@/components/layout/header";
import { ThemeSwitcher } from "@/components/theme-switcher";

export const Route = createFileRoute("/_authenticated/onboarding/create-league")({
	component: CreateLeaguePage,
});

function CreateLeaguePage() {
	const navigate = useNavigate();

	const handleCancel = () => {
		navigate({ to: "/onboarding" });
	};

	return (
		<div className="flex min-h-screen flex-col">
			<Header includeLogoutButton rightContent={<ThemeSwitcher />} />
			<div className="flex flex-1 items-center justify-center p-4">
				<div className="w-full max-w-2xl">
					<CreateLeagueForm onCancel={handleCancel} />
				</div>
			</div>
		</div>
	);
}
