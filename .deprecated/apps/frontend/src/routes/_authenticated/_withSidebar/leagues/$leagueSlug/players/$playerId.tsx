import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  getAchievementData,
  getFullAchievementData,
  getTopAchievements,
} from "@/utils/achievement-util";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Target, TrendingDown, TrendingUp, Trophy, Users } from "lucide-react";
import { useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/players/$playerId",
)({
  component: PlayerDetailPage,
});

function PlayerDetailPage() {
  const { leagueSlug, playerId } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: player,
    isLoading: playerLoading,
    error: playerError,
  } = trpc.leaguePlayer.getById.useQuery({
    leagueSlug,
    leaguePlayerId: playerId,
  });

  useEffect(() => {
    if (
      playerError?.data?.code === "BAD_REQUEST" &&
      playerError?.message?.includes("Player profiles are not available for 3-1-0 seasons")
    ) {
      navigate({
        to: "/leagues/$leagueSlug",
        params: { leagueSlug },
        search: { errorCode: "PLAYER_PROFILE_NOT_SUPPORTED" },
      });
    }
  }, [playerError, navigate, leagueSlug]);

  const shouldSkipQueries = playerError?.data?.code === "BAD_REQUEST";

  const { data: playerStats, isLoading: statsLoading } = trpc.leaguePlayer.getPlayerStats.useQuery(
    {
      leagueSlug,
      leaguePlayerId: playerId,
    },
    {
      enabled: !shouldSkipQueries,
    },
  );

  const { data: eloProgression, isLoading: eloLoading } =
    trpc.leaguePlayer.getEloProgression.useQuery(
      {
        leagueSlug,
        leaguePlayerId: playerId,
      },
      {
        enabled: !shouldSkipQueries,
      },
    );

  const { data: recentMatches, isLoading: matchesLoading } =
    trpc.leaguePlayer.getRecentMatches.useQuery(
      {
        leagueSlug,
        leaguePlayerId: playerId,
      },
      {
        enabled: !shouldSkipQueries,
      },
    );

  const { data: bestTeammate, isLoading: bestTeammateLoading } =
    trpc.leaguePlayer.getBestTeammate.useQuery(
      {
        leagueSlug,
        leaguePlayerId: playerId,
      },
      {
        enabled: !shouldSkipQueries,
      },
    );

  const { data: worstTeammate, isLoading: worstTeammateLoading } =
    trpc.leaguePlayer.getWorstTeammate.useQuery(
      {
        leagueSlug,
        leaguePlayerId: playerId,
      },
      {
        enabled: !shouldSkipQueries,
      },
    );

  const { data: bestSeason, isLoading: bestSeasonLoading } =
    trpc.leaguePlayer.getBestSeason.useQuery(
      {
        leagueSlug,
        leaguePlayerId: playerId,
      },
      {
        enabled: !shouldSkipQueries,
      },
    );

  const { data: userAchievements, isLoading: achievementsLoading } =
    trpc.achievement.getUserAchievements.useQuery(
      {
        leagueSlug,
        leaguePlayerId: playerId,
      },
      {
        enabled: !shouldSkipQueries,
      },
    );

  if (playerError) {
    if (playerError.data?.code === "BAD_REQUEST") {
      return (
        <div className="min-h-screen p-6">
          <div className="mx-auto max-w-7xl">
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-2 text-xl font-bold">Redirecting...</h2>
                <p className="text-muted-foreground">
                  Player profiles are not available for this season type.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-7xl">
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-2 text-xl font-bold">Player Not Found</h2>
              <p className="text-muted-foreground">This player was not found in this league.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {playerLoading ? (
              <>
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-64" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={player?.user.image || "/placeholder.svg"}
                    alt={player?.user.name}
                  />
                  <AvatarFallback>{player?.user.name?.charAt(0) || "P"}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold">{player?.user.name}</h1>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
                      {playerStats?.rank || "Unranked"}
                    </Badge>
                    {playerStats?.team && <Badge variant="outline">{playerStats.team}</Badge>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current ELO
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className="mb-2 h-8 w-16" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">{playerStats?.currentElo || 0}</div>
                  <p className="flex items-center gap-1 text-xs text-green-400">
                    <TrendingUp className="h-3 w-3" />
                    +23 this season
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className="mb-2 h-8 w-16" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">{playerStats?.winRate || 0}%</div>
                  <p className="text-xs text-muted-foreground">
                    {playerStats?.wins || 0}W / {playerStats?.losses || 0}L
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Matches
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <>
                  <Skeleton className="mb-2 h-8 w-16" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">{playerStats?.totalMatches || 0}</div>
                  <p className="text-xs text-muted-foreground">42 this season</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Best Season
              </CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {bestSeasonLoading ? (
                <>
                  <Skeleton className="mb-2 h-8 w-16" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : bestSeason ? (
                <>
                  <div className="text-2xl font-bold">{bestSeason.season}</div>
                  <p className="text-xs text-muted-foreground">
                    Peak ELO: {bestSeason.elo} ({bestSeason.matches} matches)
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">N/A</div>
                  <p className="text-xs text-muted-foreground">No seasons found</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Achievements Section */}
        <Card>
          <CardHeader>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>Unlocked gaming milestones and accomplishments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
              {achievementsLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton loaders with fixed length
                    key={`skeleton-achievement-${i}`}
                    className="flex flex-col items-center space-y-2"
                  >
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="text-center">
                      <Skeleton className="mb-1 h-4 w-20" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : userAchievements ? (
                getFullAchievementData(userAchievements.map((a) => a.type)).map((achievement) => {
                  // Get the top achievement from user's unlocked achievements for this type
                  const userAchievementTypes = userAchievements.map((a) => a.type);
                  const topUserAchievements = getTopAchievements(userAchievementTypes);
                  const topAchievementForType = topUserAchievements.find((type) => {
                    // Check if this achievement type belongs to the same group
                    const groups = {
                      win_streak: ["5_win_streak", "10_win_streak", "15_win_streak"],
                      win_loss_redemption: [
                        "3_win_loss_redemption",
                        "5_win_loss_redemption",
                        "8_win_loss_redemption",
                      ],
                      clean_sheet_streak: [
                        "5_clean_sheet_streak",
                        "10_clean_sheet_streak",
                        "15_clean_sheet_streak",
                      ],
                      goals_5_games: ["3_goals_5_games", "5_goals_5_games", "8_goals_5_games"],
                      season_winner: ["season_winner"],
                    };

                    for (const [_, groupTypes] of Object.entries(groups)) {
                      if (groupTypes.includes(achievement.type) && groupTypes.includes(type)) {
                        return true;
                      }
                    }
                    return false;
                  });

                  return (
                    <div key={achievement.type} className="flex flex-col items-center space-y-2">
                      <div className="relative">
                        {topAchievementForType ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-purple-500 bg-purple-500/20">
                                <achievement.icon className="h-8 w-8 text-purple-400" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>{getAchievementData(topAchievementForType).title}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-muted-foreground/20 bg-muted/50 opacity-50">
                            <achievement.icon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-sm font-medium ${
                            achievement.unlocked ? "" : "text-muted-foreground"
                          }`}
                        >
                          {achievement.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-8 text-center text-muted-foreground">
                  No achievements data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Charts and Teammate Analysis */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Score Progression Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>ELO Progression</CardTitle>
              <CardDescription>Score progression across seasons</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {eloLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : eloProgression && eloProgression.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={eloProgression}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="season" className="stroke-muted-foreground" fontSize={12} />
                      <YAxis className="stroke-muted-foreground" fontSize={12} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length && payload[0]) {
                            return (
                              <div className="rounded-lg border bg-background p-3 shadow-lg">
                                <p className="font-medium">{payload[0].payload.season}</p>
                                <p className="text-purple-400">ELO: {payload[0].value}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="elo"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No ELO progression data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Best Teammate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Best Teammate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bestTeammateLoading ? (
                <>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </>
              ) : bestTeammate ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={bestTeammate.avatar || "/placeholder.svg"}
                        alt={bestTeammate.name}
                      />
                      <AvatarFallback>{bestTeammate.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{bestTeammate.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {bestTeammate.matchesTogether} matches together
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Win Rate</span>
                      <span className="text-sm font-medium text-green-400">
                        {bestTeammate.winRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Record</span>
                      <span className="text-sm font-medium">
                        {bestTeammate.wins}W-{bestTeammate.losses}L
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">ELO Impact</span>
                      <span className="text-sm font-medium text-green-400">
                        +{bestTeammate.eloGained}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No teammate data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Matches per Season and Worst Teammate */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Matches per Season Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Matches per Season</CardTitle>
              <CardDescription>Activity level across different seasons</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {eloLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : eloProgression && eloProgression.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eloProgression}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="season" className="stroke-muted-foreground" fontSize={12} />
                      <YAxis className="stroke-muted-foreground" fontSize={12} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length && payload[0]) {
                            return (
                              <div className="rounded-lg border bg-background p-3 shadow-lg">
                                <p className="font-medium">{payload[0].payload.season}</p>
                                <p className="text-cyan-400">Matches: {payload[0].value}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="matches" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No matches data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Worst Teammate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-400" />
                Worst Teammate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {worstTeammateLoading ? (
                <>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </>
              ) : worstTeammate ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={worstTeammate.avatar || "/placeholder.svg"}
                        alt={worstTeammate.name}
                      />
                      <AvatarFallback>{worstTeammate.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{worstTeammate.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {worstTeammate.matchesTogether} matches together
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Win Rate</span>
                      <span className="text-sm font-medium text-red-400">
                        {worstTeammate.winRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Record</span>
                      <span className="text-sm font-medium">
                        {worstTeammate.wins}W-{worstTeammate.losses}L
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">ELO Impact</span>
                      <span className="text-sm font-medium text-red-400">
                        {worstTeammate.eloLost}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No teammate data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
            <CardDescription>Latest match results and ELO changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {matchesLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton loaders with fixed length
                    key={`skeleton-match-${i}`}
                    className="flex items-center justify-between rounded-lg bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-8" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))
              ) : recentMatches && recentMatches.length > 0 ? (
                recentMatches.map((match) => (
                  <div
                    key={`${match.date}-${match.opponent}-${match.score}`}
                    className="flex items-center justify-between rounded-lg bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-4">
                      <Badge
                        variant={
                          match.result === "W"
                            ? "default"
                            : match.result === "L"
                              ? "destructive"
                              : "secondary"
                        }
                        className={match.result === "W" ? "bg-green-600/20 text-green-300" : ""}
                      >
                        {match.result}
                      </Badge>
                      <div>
                        <p className="font-medium">vs {match.opponent}</p>
                        <p className="text-sm text-muted-foreground">{match.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{match.score}</p>
                      <p
                        className={`text-sm ${
                          match.eloChange > 0
                            ? "text-green-400"
                            : match.eloChange < 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {match.eloChange > 0 ? "+" : ""}
                        {match.eloChange} ELO
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No recent matches available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
