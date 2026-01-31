export type ChartData = {
  label: string;
  labelDescription?: string;
  [key: string]: string | number | undefined;
};

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

export const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export const formatDate = (date: Date) => date.toISOString().split("T")[0] as string;

export const getDateOfISOWeek = (year: number, week: number): Date => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
};

export const getAllChartKeys = (data?: ChartData[]) =>
  data
    ? Array.from(
        new Set(
          data.flatMap((item) => {
            const { label, labelDetail, ...rest } = item;
            return Object.keys(rest);
          }),
        ),
      )
    : [];

export const createChartConfig = ({
  chartKeys,
  seasonPlayers,
}: {
  chartKeys: string[];
  seasonPlayers: { seasonPlayerId: string; user: { name: string } }[];
}) => {
  let counter = 0;
  const chartConfig: Record<string, { label: string; color: string }> = {};
  for (const seasonPlayerId of chartKeys) {
    chartConfig[seasonPlayerId] = {
      label: seasonPlayers?.find((sp) => sp.seasonPlayerId === seasonPlayerId)?.user.name ?? "",
      color: `hsl(var(--chart-${(counter % 5) + 1}))`,
    };
    counter++;
  }
  return chartConfig;
};
