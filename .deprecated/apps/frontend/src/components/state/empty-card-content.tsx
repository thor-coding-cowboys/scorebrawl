import type { ReactNode } from "react";

export const EmptyCardContent = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-center h-64">{children}</div>
);

export const EmptyCardContentText = ({ children }: { children: ReactNode }) => (
  <EmptyCardContent>
    <p className="text-gray-500 text-sm">{children}</p>
  </EmptyCardContent>
);
