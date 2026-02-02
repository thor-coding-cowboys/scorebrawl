import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Welcome to Scorebrawl!</CardTitle>
            <CardDescription className="text-lg">
              Let's get you started by creating your first league.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <p className="text-center text-muted-foreground">
              A league is where you track scores, manage players, and compete with friends. Whether
              it's board games, sports, or any competition, Scorebrawl helps you keep track of
              everything.
            </p>

            <div className="w-full space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">What you can do with leagues:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                  <li>Track matches and scores in real-time</li>
                  <li>Manage players and teams</li>
                  <li>View standings and statistics</li>
                  <li>Create multiple seasons</li>
                  <li>Unlock achievements</li>
                </ul>
              </div>
            </div>

            <Button asChild size="lg">
              <Link to="/onboarding/leagues">Create your first league</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
