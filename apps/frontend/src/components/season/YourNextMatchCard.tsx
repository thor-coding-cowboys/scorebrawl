import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { CalendarClockIcon } from "lucide-react";
import { CardContentText } from "./CardContentText";
import { DashboardCard } from "./DashboardCard";
import { FixtureButton, useFixturesRounds } from "./Fixtures";

export const YourNextMatchCard = () => {
  const { data: rounds, isLoading } = useFixturesRounds();
  const { data: session } = authClient.useSession();
  const nextMatch = rounds
    ?.flatMap((f) => f.fixtures)
    .find(
      (fixture) =>
        !fixture.matchId &&
        (fixture.player1.user.userId === session?.user.id ||
          fixture.player2.user.userId === session?.user.id),
    );
  return (
    <DashboardCard Icon={CalendarClockIcon} title={"Your Next Match"}>
      {isLoading && <Skeleton className={"gap-2 h-14 w-full"} />}
      {nextMatch && <FixtureButton fixture={nextMatch} />}
      {!isLoading && !nextMatch && (
        <CardContentText>You have finished all matches for the season</CardContentText>
      )}
    </DashboardCard>
  );
};
