import type * as React from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  return (
    <footer className={cn(className)}>
      <div className="container flex items-center justify-end py-4">
        <ModeToggle />
      </div>
    </footer>
  );
}
