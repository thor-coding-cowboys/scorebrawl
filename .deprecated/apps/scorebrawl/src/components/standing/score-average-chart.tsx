"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getInitialsFromString } from "@scorebrawl/utils/string";

const chartConfig = {} satisfies ChartConfig;

interface Player {
  name: string;
  image?: string;
  scoreAverage: number;
}

export function ScoreAverageChart({ data, loading }: { data: Player[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="w-full h-[400px]" />
      </div>
    );
  }
  if (!Array.isArray(data) || data.length === 0) {
    return <div>No data available for Score Average Chart</div>;
  }

  const validData = data.filter((player) => typeof player.scoreAverage === "number");
  const sortedData = [...validData].sort((a, b) => b.scoreAverage - a.scoreAverage);
  const max = Math.ceil(Math.max(...data.map((obj) => obj.scoreAverage)));
  const min = Math.floor(Math.min(...data.map((obj) => obj.scoreAverage)));
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ChartContainer config={chartConfig}>
        <BarChart
          accessibilityLayer
          data={sortedData}
          margin={{
            right: 20,
            top: 60,
            bottom: 20,
            left: -20,
          }}
          maxBarSize={40}
        >
          <CartesianGrid vertical={false} />
          <YAxis
            domain={[min, 0, max]}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            ticks={[min, 0, max]}
            tickFormatter={(value) => value.toFixed(0)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0]?.payload;
                return (
                  <div className="bg-sidebar p-2 border rounded shadow">
                    <p className="font-bold">{data.name}</p>
                    <p className="">Score Average: {data.scoreAverage.toFixed(2)}</p>
                  </div>
                );
              }
              return null;
            }}
          />

          <Bar dataKey="scoreAverage" fill="hsl(var(--primary))" radius={4} animationDuration={200}>
            <LabelList
              content={(props) => {
                const user = props.index != null ? sortedData[props.index] : null;
                if (!user) {
                  return null;
                }
                const x = Number(props.x);
                const y = Number(props.y);
                const barWidth = Number(props.width);
                const barHeight = Number(props.height);
                const value = Number(props.value);
                const spacing = 6;
                const isPositive = value > 0;

                return (
                  <foreignObject
                    x={x}
                    y={y - (isPositive ? barWidth : -(barHeight - barWidth - 2)) - spacing}
                    width={barWidth}
                    height={barWidth}
                  >
                    <div className="w-full h-full">
                      <Avatar className="w-auto h-auto">
                        <AvatarImage src={user.image} alt={getInitialsFromString(user.name)} />
                        <AvatarFallback className="aspect-square">
                          {getInitialsFromString(user.name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </foreignObject>
                );
              }}
            />
            {sortedData.map((entry) => (
              <Cell key={entry.name} className={cn(entry.scoreAverage < 0 && "fill-rose-500")} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ResponsiveContainer>
  );
}
