import { CreateLeagueForm } from "@/components/league/CreateLeagueForm";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/onboarding/leagues")({
  component: OnboardingCreateLeaguePage,
});

function OnboardingCreateLeaguePage() {
  const navigate = useNavigate();

  const handleSuccess = (leagueSlug: string) => {
    // After creating first league during onboarding, go to that league
    navigate({ to: "/leagues/$leagueSlug", params: { leagueSlug } });
  };

  const handleCancel = () => {
    // Go back to onboarding welcome page
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <CreateLeagueForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </div>
    </div>
  );
}
