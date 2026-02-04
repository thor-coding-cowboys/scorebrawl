import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateLeagueForm } from "@/components/leagues/create-league-form";
import { Header } from "@/components/layout/header";

export const Route = createFileRoute("/_authenticated/leagues/create")({
	component: CreateLeaguePage,
});

function CreateLeaguePage() {
	const navigate = useNavigate();

	const handleCancel = () => {
		navigate({ to: "/" });
	};

	return (
		<div className="flex min-h-screen flex-col">
			<Header includeLogoutButton />
			<div className="flex flex-1 items-center justify-center p-4">
				<div className="w-full max-w-2xl">
					<CreateLeagueForm onCancel={handleCancel} />
				</div>
			</div>
		</div>
	);
}
