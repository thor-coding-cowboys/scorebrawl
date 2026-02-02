import { format } from "date-fns";
import type { ChartData } from "./utils";

type InputData = {
  seasonPlayerId: string;
  score: number;
  createdAt: Date;
};

export const transformData = ({
  data,
  startDate,
  endDate = new Date(),
  initialScore,
}: {
  data: InputData[];
  endDate?: Date;
  startDate: Date;
  initialScore: number;
}) => {
  const sortedData = data.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lastScores = Array.from(new Set<string>(data.map((d) => d.seasonPlayerId))).reduce<
    Record<string, number>
  >((acc, key) => {
    acc[key] = initialScore;
    return acc;
  }, {});
  const playerScores: Record<string, { matchDate: Date; score: number }[]> = sortedData.reduce(
    (
      acc: Record<string, { matchDate: Date; score: number }[]>,
      { seasonPlayerId, createdAt, score },
    ) => {
      if (!acc[seasonPlayerId]) {
        acc[seasonPlayerId] = [{ matchDate: createdAt, score }];
      } else {
        acc[seasonPlayerId]?.push({
          matchDate: new Date(createdAt),
          score,
        });
      }

      return acc;
    },
    {} satisfies Record<string, number[]>,
  );

  const output: ChartData[] = [];
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const outputItem: ChartData = { label: format(date, "MM-dd") };
    for (const player in playerScores) {
      const dateClone = new Date(date);
      const playerData = playerScores[player];
      const playerDataIndex = playerData?.find(
        (data) =>
          data.matchDate.getFullYear() === dateClone.getFullYear() &&
          data.matchDate.getMonth() === dateClone.getMonth() &&
          data.matchDate.getDate() === dateClone.getDate(),
      );

      if (playerDataIndex) {
        outputItem[player] = playerDataIndex.score;
        lastScores[player] = playerDataIndex.score;
      } else {
        outputItem[player] = lastScores[player];
      }
    }
    output.push(outputItem);
  }

  return [...output];
};
