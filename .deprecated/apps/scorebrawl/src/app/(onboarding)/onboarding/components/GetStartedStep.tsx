import { LeagueForm } from "@/components/league/league-form";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const GetStartedStep = () => {
  return (
    <>
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>
          Create your first league or join an existing one to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LeagueForm buttonTitle="Create League" />
      </CardContent>
    </>
  );
};
