import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export const LayoutActionButton = ({
  text,
  Icon,
  onClick,
  variant = "default",
  disabled = false,
}: {
  text: string;
  Icon?: LucideIcon;
  onClick?: () => void;
  variant?: "outline" | "default";
  disabled?: boolean;
}) => (
  <Button size={"sm"} variant={variant} onClick={onClick} disabled={disabled}>
    {Icon && <Icon className="mr-1 h-4 w-4" />}
    {text}
  </Button>
);
