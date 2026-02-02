import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

export const OverviewCard = ({
  title,
  description,
  children,
}: { title: string; description?: string; children: ReactNode }) => (
  <Card>
    <CardHeader>
      <CardTitle> {title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
