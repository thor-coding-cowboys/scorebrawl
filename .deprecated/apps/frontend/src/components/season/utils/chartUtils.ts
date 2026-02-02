export type InputData = {
  seasonPlayerId: string;
  score: number;
  createdAt: Date;
};

export type OutputData = {
  label: string;
  labelDetail?: string;
  [key: string]: number | string | undefined;
};

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const formatDate = (date: Date) => date.toISOString().split("T")[0] as string;

export const transformData = (inputData?: InputData[]) => {
  if (!inputData || inputData.length === 0) {
    return [];
  }
  // Sort the input data by date
  const sortedData = inputData.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Calculate the date range
  const startDate = new Date((sortedData[0] as InputData).createdAt);
  const endDate = new Date((sortedData[sortedData.length - 1] as InputData).createdAt);
  const dateRangeInDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

  // Determine if we need to group by week
  const groupByWeek = dateRangeInDays > 21;

  const outputMap = new Map<string, OutputData>();

  for (const item of sortedData) {
    const date = new Date(item.createdAt);
    let key: string;
    let labelDetail: string | undefined;

    if (groupByWeek) {
      const weekNumber = getWeekNumber(date);
      const weekStart = getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      key = `${date.getFullYear()}-W${weekNumber.toString().padStart(2, "0")}`;
      labelDetail = `${formatDate(weekStart)} to ${formatDate(weekEnd)}`;
    } else {
      key = formatDate(date);
    }

    if (!outputMap.has(key)) {
      outputMap.set(key, { label: key, labelDetail });
    }

    const output = outputMap.get(key) as OutputData;
    if (output[item.seasonPlayerId] === undefined) {
      output[item.seasonPlayerId] = item.score;
    } else if (groupByWeek) {
      // For week grouping, calculate the average
      const currentTotal =
        (output[item.seasonPlayerId] as number) *
        ((output[`${item.seasonPlayerId}_count`] as number) || 1);
      const newTotal = currentTotal + item.score;
      output[`${item.seasonPlayerId}_count`] =
        ((output[`${item.seasonPlayerId}_count`] as number) || 1) + 1;
      output[item.seasonPlayerId] = newTotal / (output[`${item.seasonPlayerId}_count`] as number);
    } else {
      // For daily grouping, use the higher score
      output[item.seasonPlayerId] = Math.max(output[item.seasonPlayerId] as number, item.score);
    }
  }

  // Clean up the count properties used for averaging
  if (groupByWeek) {
    for (const value of outputMap.values()) {
      for (const key of Object.keys(value)) {
        if (key.endsWith("_count")) {
          delete value[key];
        }
      }
    }
  }

  return Array.from(outputMap.values());
};
