import type { Season } from "@/db/types";
import { getPeriodStatus } from "@scorebrawl/utils/date";

export const sortSeasons = (seasons: Season[]): Season[] => {
  const now = new Date();
  const ongoingObjects: Season[] = [];
  const otherObjects: Season[] = [];

  // Partition the objects into ongoing and other objects
  for (const season of seasons) {
    if (season.startDate <= now && (season.endDate === null || now <= season.endDate)) {
      ongoingObjects.push(season);
    } else {
      otherObjects.push(season);
    }
  }

  // Sort other objects by start date in descending order
  otherObjects.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  // Concatenate ongoingObjects and otherObjects
  return [...ongoingObjects, ...otherObjects].map((season) => ({
    ...season,
    label: getPeriodStatus(season),
  }));
};
