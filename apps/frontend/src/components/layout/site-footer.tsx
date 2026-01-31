import type * as React from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  return (
    <footer className={cn("w-full", className)}>
      <div className="flex items-center justify-end py-4 px-4">
        <ModeToggle />
      </div>
    </footer>
  );
}
