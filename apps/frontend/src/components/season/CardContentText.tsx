import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const CardContentText = ({
  className,
  children,
}: { className?: string; children: ReactNode }) => (
  <p className={cn("text-xs font-medium text-gray-800 dark:text-white", className)}>{children}</p>
);
