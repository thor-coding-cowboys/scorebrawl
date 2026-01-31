import { format } from "date-fns";
import type { ChartData } from "./utils";

type InputData = {
  seasonPlayerId: string;
  matchDate: string;
  pointDiff: number;
};

export const transformData = ({
  data,
  startDate,
}: {
  data: InputData[];
  startDate: Date;
}) => {
  const currentDate = new Date();
  const sortedData = data.sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
  );
  const playerScores: Record<string, { matchDate: Date; pointDiff: number }[]> = sortedData.reduce(
    (
      acc: Record<string, { matchDate: Date; pointDiff: number }[]>,
      { seasonPlayerId, matchDate, pointDiff },
    ) => {
      if (!acc[seasonPlayerId]) {
        acc[seasonPlayerId] = [{ matchDate: new Date(matchDate), pointDiff }];
      } else {
        acc[seasonPlayerId].push({
          matchDate: new Date(matchDate),
          pointDiff,
        });
      }

      return acc;
    },
    {} satisfies Record<string, number[]>,
  );

  const output: ChartData[] = [];
  for (let date = new Date(startDate); date <= currentDate; date.setDate(date.getDate() + 1)) {
    const outputItem: ChartData = { label: format(date, "MM-dd") };
    for (const player in playerScores) {
      const dateClone = new Date(date); // Clone the date to avoid reference issues

      const playerData = playerScores[player];
      const playerDataIndex = playerData?.find(
        (data) =>
          data.matchDate.getFullYear() === dateClone.getFullYear() &&
          data.matchDate.getMonth() === dateClone.getMonth() &&
          data.matchDate.getDate() === dateClone.getDate(),
      );

      if (playerDataIndex) {
        outputItem[player] = playerDataIndex.pointDiff;
      } else {
        outputItem[player] = 0;
      }
    }
    output.push(outputItem);
  }

  return [...output];
};
