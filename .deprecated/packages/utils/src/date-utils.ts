export const getPeriodStatus = ({
  startDate,
  endDate,
}: { startDate: Date; endDate: Date | null }): "ongoing" | "future" | "finished" => {
  const now = new Date();
  return startDate <= now && (endDate === null || now <= endDate)
    ? "ongoing"
    : startDate > now
      ? "future"
      : "finished";
};
