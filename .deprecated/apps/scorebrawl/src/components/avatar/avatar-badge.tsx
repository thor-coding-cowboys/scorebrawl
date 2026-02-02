import type { AvatarProps } from "@/components/multi-avatar";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { AvatarWithFallback } from "./avatar-with-fallback";

export interface AvatarBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  item: AvatarProps;
}

export const AvatarBadge = ({ item, variant, onClick, className, children }: AvatarBadgeProps) => {
  return (
    <Badge
      key={item.id}
      variant={variant}
      className={cn("mr-2 text-xs px-3 w-32", className)}
      onClick={onClick}
    >
      <AvatarWithFallback className="mr-2" image={item.image} name={item.name} />
      <p className="truncate">{item.name}</p>
      {children}
    </Badge>
  );
};
