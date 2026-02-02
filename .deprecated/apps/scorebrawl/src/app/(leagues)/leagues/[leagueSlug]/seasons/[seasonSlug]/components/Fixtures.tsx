"use client";
import { MultiAvatar } from "@/components/multi-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeason } from "@/context/season-context";
import type { SeasonPlayerDTO } from "@/dto";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { CheckIcon, Loader2, MinusIcon, PenIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { z } from "zod";

type Fixture = {
  id: string;
  matchId: string | null;
  player1: z.output<typeof SeasonPlayerDTO>;
  player2: z.output<typeof SeasonPlayerDTO>;
};

type FixtureRound = {
  id: string;
  name: string;
  fixtures: Fixture[];
};

const ScoreStepper = ({
  score = 0,
  setScore,
}: {
  score: number;
  setScore: (score: number) => void;
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={() => setScore(Math.max(score - 1, 0))}
        type="button"
      >
        <MinusIcon className="h-4 w-4" />
        <span className="sr-only">Decrease</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={() => setScore(score + 1)}
        type="button"
      >
        <PlusIcon className="h-4 w-4" />
        <span className="sr-only">Increase</span>
      </Button>
    </div>
  );
};

const UserRow = ({
  player,
  score,
  winner,
}: { player: z.output<typeof SeasonPlayerDTO>; score: number | null; winner?: boolean }) => {
  const getPlayerName = (name: string) => {
    const parts = name.split(" ");
    return parts.length > 2 ? `${parts[0]} ${parts[1]}` : parts[0];
  };
  return (
    <div className="grid grid-cols-[auto_auto_1fr] items-center gap-2 sm:gap-4 truncate">
      <MultiAvatar
        visibleCount={1}
        users={[
          {
            id: player.user.userId,
            name: player.user.name,
            image: player.user.image,
          },
        ]}
      />
      <div className="grid items-center">
        <p className={cn("text-sm font-medium truncate", winner && "font-bold")}>
          {getPlayerName(player.user.name)}
        </p>
      </div>
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center justify-self-end rounded-md border font-medium",
          score !== null && "bg-primary/10",
          winner && "bg-primary/20 font-bold",
        )}
      >
        {score !== null ? score : ""}
      </div>
    </div>
  );
};

export const FixtureButton = ({ fixture }: { fixture: Fixture }) => {
  const { leagueSlug, seasonSlug } = useSeason();
  const utils = api.useUtils();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMatchCreate, setShowMatchCreate] = useState(false);
  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const { mutate } = api.match.createFixtureMatch.useMutation();
  const { data: matchResults } = api.match.getById.useQuery(
    {
      leagueSlug,
      seasonSlug,
      matchId: fixture.matchId as string,
    },
    { enabled: Boolean(fixture.matchId) },
  );

  const score1 = matchResults?.homeScore ?? homeScore;
  const score2 = matchResults?.awayScore ?? awayScore;
  const homeWinner = (score1 ?? 0) > (score2 ?? 0);
  const awayWinner = (score2 ?? 0) > (score1 ?? 0);
  return (
    <div className="flex gap-4 w-full p-2 bg-transparent rounded-lg hover:bg-muted/50 hover:shadow-sm">
      <div className="w-full">
        <div className="grid grid-rows-2 bg-transparent gap-2 w-full h-auto items-center hover:bg-transparent transition-all cursor-pointer truncate">
          <UserRow player={fixture.player1} score={score1} winner={homeWinner} />
          <UserRow player={fixture.player2} score={score2} winner={awayWinner} />
        </div>
      </div>
      <div className="w-px bg-border" />
      <div className="flex">
        {showMatchCreate ? (
          <div className="grid grid-rows-3 bg-transparent gap-4 w-full h-auto items-center hover:bg-transparent transition-all cursor-pointer truncate">
            <div className="flex items-center justify-between gap-2 sm:gap-4 truncate">
              <ScoreStepper
                score={homeScore ?? 0}
                setScore={(newScore) => {
                  setHomeScore(newScore);
                  setAwayScore((prev) => prev ?? 0);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <ScoreStepper
                score={awayScore ?? 0}
                setScore={(newScore) => {
                  setHomeScore((prev) => prev ?? 0);
                  setAwayScore(newScore);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant={"outline"}
                className={"px-2"}
                onClick={() => {
                  setShowMatchCreate(false);
                  setHomeScore(null);
                  setAwayScore(null);
                }}
              >
                <XIcon size={20} className={"text-red-500"} />
              </Button>
              <Button
                variant={"outline"}
                className={"px-2"}
                onClick={() => {
                  setShowMatchCreate(false);
                  setIsSubmitting(true);
                  mutate(
                    {
                      leagueSlug,
                      seasonSlug,
                      homeScore: homeScore ?? 0,
                      awayScore: awayScore ?? 0,
                      seasonFixtureId: fixture.id,
                    },
                    {
                      onSuccess: async () => {
                        await utils.season.getFixtures.invalidate();
                        utils.seasonPlayer.getStanding.invalidate();
                        utils.seasonPlayer.getAll.invalidate();
                        utils.seasonPlayer.getTop.invalidate();
                        utils.seasonPlayer.getStruggling.invalidate();
                        utils.seasonPlayer.getOnFire.invalidate();
                        utils.seasonTeam.getStanding.invalidate();
                        utils.match.getAll.invalidate();
                        utils.match.getLatest.invalidate();
                        setIsSubmitting(false);
                        setAwayScore(null);
                        setHomeScore(null);
                      },
                      onSettled: () => {
                        toast({
                          title: "Match created",
                          description: "Match has been created successfully",
                        });
                      },
                      onError: () => {
                        setIsSubmitting(false);
                        setShowMatchCreate(true);
                        toast({
                          title: "Failed to create match",
                          description:
                            "Something went wrong while creating the match, please try again",
                          variant: "destructive",
                        });
                      },
                    },
                  );
                }}
              >
                <CheckIcon size={20} className={"text-green-500"} />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            disabled={Boolean(fixture.matchId || isSubmitting)}
            onClick={() => setShowMatchCreate(true)}
            className="flex w-8 h-8 self-center justify-center items-center p-0 "
          >
            {!fixture.matchId && isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PenIcon
                className={cn("h-4 w-4", (fixture.matchId || isSubmitting) && "opacity-0")}
              />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export const useFixturesRounds = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const { data: fixtures, isLoading: isLoadingFixtures } = api.season.getFixtures.useQuery({
    leagueSlug,
    seasonSlug,
  });

  const { data: players, isLoading } = api.seasonPlayer.getAll.useQuery({
    leagueSlug,
    seasonSlug,
  });

  const usersMap = players?.reduce<{ [id: string]: z.output<typeof SeasonPlayerDTO> }>(
    (acc, player) => {
      acc[player.seasonPlayerId] = player;
      return acc;
    },
    {},
  );

  function transformData() {
    const roundsMap: Record<string, FixtureRound> = {};

    if (fixtures) {
      for (const fixture of fixtures) {
        const roundId = fixture.round.toString();

        if (!roundsMap[roundId]) {
          roundsMap[roundId] = {
            id: roundId,
            name: `Round ${fixture.round}`,
            fixtures: [],
          };
        }
        const player1 = fixture.homePlayerId && usersMap?.[fixture.homePlayerId];
        const player2 = fixture.awayPlayerId && usersMap?.[fixture.awayPlayerId];
        if (player1 && player2) {
          roundsMap[roundId]?.fixtures.push({
            id: fixture.id,
            matchId: fixture.matchId,
            player1,
            player2,
          });
        }
      }
    }
    return Object.values(roundsMap);
  }
  return { data: transformData(), isLoading: isLoading || isLoadingFixtures };
};

export const Fixtures = () => {
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const { data: rounds, isLoading } = useFixturesRounds();

  if (isLoading) {
    return <Skeleton className="w-full h-80" />;
  }
  const roundIndex = rounds.findIndex((round) => round.fixtures.some((f) => !f.matchId));
  const currentRound = rounds[roundIndex];
  const firstRound = rounds[0];
  const lastRound = rounds[rounds.length - 1];
  const roundsToShow = currentRound
    ? [
        ...(showPrev ? rounds.slice(0, roundIndex) : []),
        currentRound,
        ...(showNext ? rounds.slice(roundIndex + 1) : []),
      ]
    : rounds;

  return (
    <div className="flex w-full flex-col gap-2">
      {firstRound && roundsToShow.indexOf(firstRound) === -1 && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => setShowPrev(true)}
        >
          Show previous rounds
        </Button>
      )}
      <div className="space-y-8">
        {roundsToShow.map((round) => (
          <div key={round.id} className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{round.name}</h3>
              <div className="h-px bg-border" />
            </div>
            <div className="space-y-4">
              {round.fixtures.map((match, i) => (
                <>
                  <FixtureButton key={match.id} fixture={match} />
                  {i < round.fixtures.length - 1 && <div className="h-px bg-border" />}
                </>
              ))}
            </div>
          </div>
        ))}
      </div>
      {lastRound && roundsToShow.indexOf(lastRound) === -1 && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => setShowNext(true)}
        >
          Show upcoming rounds
        </Button>
      )}
    </div>
  );
};
