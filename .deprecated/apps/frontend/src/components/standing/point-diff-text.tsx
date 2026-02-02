import { cn } from "@/lib/utils";

export const PointDiffText = ({ diff }: { diff?: number }) => {
  if (diff) {
    const colorClass = diff > 0 ? "text-green-400" : diff < 0 ? "text-rose-900" : "";
    return <div className={cn(colorClass)}>{Math.abs(diff)}</div>;
  }
  return null;
};
