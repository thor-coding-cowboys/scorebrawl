"use client";
import {
  createChartConfig,
  getAllChartKeys,
} from "@/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/charts/utils";
import { EmptyCardContentText } from "@/components/state/empty-card-content";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useSeason } from "@/context/season-context";
import { api } from "@/trpc/react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { transformData } from "./charts/pointProgressionUtils";

export const PointProgression = () => {
  const { seasonSlug, leagueSlug } = useSeason();
  const { data: season } = api.season.findBySlug.useQuery({ leagueSlug, seasonSlug });
  const { data: seasonPlayers } = api.seasonPlayer.getAll.useQuery({ leagueSlug, seasonSlug });
  const { data } = api.seasonPlayer.getPointProgression.useQuery({ leagueSlug, seasonSlug });
  const { data: latestMatch } = api.match.getLatest.useQuery({
    leagueSlug,
    seasonSlug,
  });

  if (seasonPlayers === undefined || data === undefined || season === undefined) return null; // possibly loading state?
  const chartData = transformData({
    startDate: season.startDate,
    data,
    initialScore: season.initialScore,
    endDate: latestMatch?.createdAt,
  });

  if (chartData.length < 2) {
    return <EmptyCardContentText>Not enough data to display chart</EmptyCardContentText>;
  }
  const chartKeys = getAllChartKeys(chartData);
  const dataMin = Math.min(...data.map((key) => key.score)) - 50;
  const dataMax = Math.max(...data.map((key) => key.score)) + 50;

  return (
    <ChartContainer config={createChartConfig({ chartKeys, seasonPlayers })}>
      <LineChart
        accessibilityLayer
        data={chartData}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          hide={true}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <YAxis hide domain={[dataMin, dataMax]} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        {chartData.length > 0 &&
          chartKeys.map((key) => {
            return (
              <Line
                key={key}
                dataKey={key}
                type="monotone"
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
              />
            );
          })}
      </LineChart>
    </ChartContainer>
  );
};
