import { CreateLeagueForm } from "@/components/league/CreateLeagueForm";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_withSidebar/leagues/create")({
  component: CreateLeaguePage,
});

function CreateLeaguePage() {
  return (
    <div className="container max-w-2xl py-8">
      <CreateLeagueForm />
    </div>
  );
}
