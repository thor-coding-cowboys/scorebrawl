"use client";

import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useSeason } from "@/context/season-context";
import { SeasonPlayerStandingDTO } from "@/dto";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { capitalize } from "@scorebrawl/utils/string";
import { isAfter, isWithinInterval } from "date-fns";
import { CircleEqual, MinusIcon, PlusIcon, Shuffle, TriangleAlert } from "lucide-react";

import { AvatarWithFallback } from "@/components/avatar/avatar-with-fallback";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PlayerSelection } from "./playerSelection";

const schema = z.object({
  awayPlayers: SeasonPlayerStandingDTO.array().min(1),
  homePlayers: SeasonPlayerStandingDTO.array().min(1),
  homeScore: z.coerce.number().min(0),
  awayScore: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof schema>;

type SeasonPlayerType = z.infer<typeof SeasonPlayerStandingDTO>;

export type PlayerWithSelection = SeasonPlayerType & { team?: "home" | "away" };

export const MatchForm = () => {
  const { leagueSlug, seasonSlug } = useSeason();
  const { data: season } = api.season.getBySlug.useQuery({ leagueSlug, seasonSlug });
  const now = new Date();
  const isSeasonActive = season?.endDate
    ? isWithinInterval(now, { start: season.startDate, end: season.endDate })
    : season && isAfter(now, season.startDate);

  const { data: seasonPlayers } = api.seasonPlayer.getStanding.useQuery({ leagueSlug, seasonSlug });
  const { toast } = useToast();
  const utils = api.useUtils();
  const { mutate, isPending } = api.match.createEloMatch.useMutation();
  const { push } = useRouter();

  const [teamSelection, setTeamSelection] = useState<PlayerWithSelection[]>([]);

  useEffect(() => {
    setTeamSelection(seasonPlayers ?? []);
  }, [seasonPlayers]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      homeScore: 0,
      homePlayers: [],
      awayScore: 0,
      awayPlayers: [],
    },
  });

  // TODO strikeover selected in other team
  // TODO shuffle and even in selection drawer
  // Button aligned with create

  const shuffleTeams = () => {
    const allPlayers = [...form.getValues().homePlayers, ...form.getValues().awayPlayers];

    // Fisher-Yates shuffle algorithm
    for (let i = allPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // @ts-expect-error it's ok
      [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
    }

    const halfLength = Math.floor(allPlayers.length / 2);
    const newHomePlayers = allPlayers
      .slice(0, halfLength)
      .map((p) => ({ ...p, team: "home" as const }));
    const newAwayPlayers = allPlayers
      .slice(halfLength)
      .map((p) => ({ ...p, team: "away" as const }));

    form.setValue("homePlayers", newHomePlayers);
    form.setValue("awayPlayers", newAwayPlayers);
    setTeamSelection(
      teamSelection.map((p) => {
        if (newHomePlayers.map((n) => n.seasonPlayerId).includes(p.seasonPlayerId)) {
          return { ...p, team: "home" };
        }
        if (newAwayPlayers.map((n) => n.seasonPlayerId).includes(p.seasonPlayerId)) {
          return { ...p, team: "away" };
        }
        return { ...p, team: undefined };
      }),
    );
  };

  const evenTeams = () => {
    const homePlayers = form.getValues().homePlayers;
    const awayPlayers = form.getValues().awayPlayers;
    const allPlayers = [...homePlayers, ...awayPlayers];

    // Sort players by score in descending order
    allPlayers.sort((a, b) => b.score - a.score);

    const newHomePlayers: PlayerWithSelection[] = [];
    const newAwayPlayers: PlayerWithSelection[] = [];
    let homeScore = 0;
    let awayScore = 0;

    // Distribute players to balance team scores
    for (const player of allPlayers) {
      if (homeScore <= awayScore) {
        newHomePlayers.push({ ...player, team: "home" });
        homeScore += player.score;
      } else {
        newAwayPlayers.push({ ...player, team: "away" });
        awayScore += player.score;
      }
    }

    // Update form values and team selection
    form.setValue("homePlayers", newHomePlayers);
    form.setValue("awayPlayers", newAwayPlayers);
    setTeamSelection(
      teamSelection.map((p) => {
        if (newHomePlayers.map((n) => n.seasonPlayerId).includes(p.seasonPlayerId)) {
          return { ...p, team: "home" };
        }
        if (newAwayPlayers.map((n) => n.seasonPlayerId).includes(p.seasonPlayerId)) {
          return { ...p, team: "away" };
        }
        return { ...p, team: undefined };
      }),
    );
  };

  const onSubmit = async ({ homeScore, homePlayers, awayPlayers, awayScore }: FormValues) => {
    mutate(
      {
        leagueSlug,
        seasonSlug,
        homeScore,
        awayScore,
        homeTeamSeasonPlayerIds: homePlayers.map((p) => p.seasonPlayerId) as [string, ...string[]],
        awayTeamSeasonPlayerIds: awayPlayers.map((p) => p.seasonPlayerId) as [string, ...string[]],
      },
      {
        onSuccess: () => {
          form.reset();
          setTeamSelection(seasonPlayers ? [...seasonPlayers] : []);
          utils.seasonPlayer.getStanding.invalidate();
          utils.seasonPlayer.getAll.invalidate();
          utils.seasonPlayer.getTop.invalidate();
          utils.seasonPlayer.getStruggling.invalidate();
          utils.seasonPlayer.getOnFire.invalidate();
          utils.seasonTeam.getStanding.invalidate();
          utils.match.getAll.invalidate();
          utils.match.getLatest.invalidate();
          toast({
            title: "Match created",
            description: "Match has been created successfully",
          });
        },
        onError: (err) => {
          toast({
            title: "Error creating match",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };
  if (!season || !seasonPlayers) {
    return null;
  }

  if (season.scoreType !== "elo") {
    push(`/leagues/${leagueSlug}?errorCode=UNSUPPORTED_SCORE_TYPE`);
    return null;
  }

  const handlePlayerSelection = (player: PlayerWithSelection) => {
    const updatedTeamSelection = teamSelection.map((p) =>
      p.seasonPlayerId === player.seasonPlayerId ? { ...p, ...player } : p,
    );

    setTeamSelection(updatedTeamSelection);
    form.setValue(
      "homePlayers",
      updatedTeamSelection.filter((p) => p.team === "home"),
    );
    form.setValue(
      "awayPlayers",
      updatedTeamSelection.filter((p) => p.team === "away"),
    );
  };

  return (
    <>
      <Form {...form}>
        <form noValidate className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <Drawer>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <FormField
                control={form.control}
                name="homeScore"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-center">
                    <FormControl>
                      <ScoreStepper
                        team={"home"}
                        score={field.value}
                        min={0}
                        onClickMinus={() => {
                          field.onChange(field.value - 1);
                        }}
                        onClickPlus={() => {
                          field.onChange(field.value + 1);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="awayScore"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-center">
                    <FormControl>
                      <ScoreStepper
                        team={"away"}
                        score={field.value}
                        min={0}
                        onClickMinus={() => {
                          field.onChange(field.value - 1);
                        }}
                        onClickPlus={() => {
                          field.onChange(field.value + 1);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="homePlayers"
                render={() => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <PlayerListCard
                        team="home"
                        teamSelection={teamSelection}
                        onSelect={handlePlayerSelection}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="awayPlayers"
                render={() => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <PlayerListCard
                        team="away"
                        teamSelection={teamSelection}
                        onSelect={handlePlayerSelection}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-4 justify-end">
              <DrawerTrigger asChild>
                <Button variant="outline">
                  <PlusIcon className="mr-1 h-4 w-4" />
                  Add Players
                </Button>
              </DrawerTrigger>
              <TeamDrawerContent
                shuffleTeams={shuffleTeams}
                evenTeams={evenTeams}
                teamSelection={teamSelection}
                handlePlayerSelection={handlePlayerSelection}
              />
              <div className="flex flex-col gap-1">
                <LoadingButton loading={isPending} type="submit">
                  Create
                </LoadingButton>
                {!isSeasonActive && (
                  <div className="text-xs text-muted-foreground flex gap-1 items-center text-yellow-600">
                    <TriangleAlert className="h-3 w-3" />
                    Season is not active
                  </div>
                )}
              </div>
            </div>
          </Drawer>
        </form>
      </Form>
    </>
  );
};

const PlayerListCard = ({
  team,
  teamSelection,
}: {
  team: "home" | "away";
  teamSelection: PlayerWithSelection[];
  onSelect: (player: PlayerWithSelection) => void;
}) => (
  <Card className={"p-0"}>
    <CardHeader>
      <CardTitle className="text-center">{capitalize(team)} Team</CardTitle>
    </CardHeader>
    <CardContent className="grid h-40 overflow-y-scroll">
      {teamSelection
        .filter((p) => p.team === team)
        .map((p) => (
          <div className="flex gap-2" key={p.user.userId}>
            <AvatarWithFallback image={p.user.image} name={p.user.name} />
            <div className="grid auto-rows-min">
              <p className="text-xs font-medium truncate">{p.user.name}</p>
              <p className="text-xs text-muted-foreground">{p.score}</p>
            </div>
          </div>
        ))}
    </CardContent>
  </Card>
);

const TeamDrawerContent = ({
  shuffleTeams,
  evenTeams,
  teamSelection,
  handlePlayerSelection,
}: {
  shuffleTeams: () => void;
  evenTeams: () => void;
  teamSelection: PlayerWithSelection[];
  handlePlayerSelection: (player: PlayerWithSelection) => void;
}) => {
  const enableReorder = () => {
    const totalPlayersSelected = teamSelection.filter((p) => p.team).length;
    return totalPlayersSelected !== 0 && totalPlayersSelected % 2 === 0;
  };
  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-xl px-4">
        <DrawerHeader>
          <DrawerTitle className="text-center">Add Players</DrawerTitle>
        </DrawerHeader>
        <div className="flex justify-around max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-muted-foreground">Home</h3>
            <PlayerSelection team="home" onSelect={handlePlayerSelection} players={teamSelection} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-muted-foreground">Away</h3>
            <PlayerSelection team="away" onSelect={handlePlayerSelection} players={teamSelection} />
          </div>
        </div>
        <Separator className="my-2" />
        <DrawerFooter className="flex flex-row items-center justify-between">
          <div className="flex gap-1">
            <Button
              disabled={!enableReorder}
              size={"sm"}
              variant="outline"
              type="button"
              onClick={shuffleTeams}
            >
              <Shuffle className="mr-2 h-4 w-4" /> Shuffle
            </Button>
            <Button
              className="ml-2"
              size={"sm"}
              disabled={!enableReorder}
              variant="outline"
              type="button"
              onClick={evenTeams}
            >
              <CircleEqual className="mr-2 h-4 w-4" /> Even
            </Button>
          </div>
          <DrawerClose asChild>
            <Button size={"sm"} variant="default">
              Done
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </div>
    </DrawerContent>
  );
};

const ScoreStepper = ({
  team,
  score,
  min,
  max,
  onClickMinus,
  onClickPlus,
}: {
  team: "home" | "away";
  score: number;
  min?: number;
  max?: number;
  onClickMinus: () => void;
  onClickPlus: () => void;
}) => {
  return (
    <div className="flex items-center justify-between w-40">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={onClickMinus}
        type="button"
        disabled={min !== undefined && score <= min}
      >
        <MinusIcon className="h-4 w-4" />
        <span className="sr-only">Decrease</span>
      </Button>
      <div className="text-center">
        <div className="text-6xl font-bold tracking-tighter">{score}</div>
        <div className="text-[0.70rem] uppercase text-muted-foreground">{team}</div>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        onClick={onClickPlus}
        type="button"
        disabled={max !== undefined && score <= max}
      >
        <PlusIcon className="h-4 w-4" />
        <span className="sr-only">Increase</span>
      </Button>
    </div>
  );
};
