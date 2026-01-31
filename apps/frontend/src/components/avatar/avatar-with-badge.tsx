import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type AvatarWithLabelProps = {
  image?: string;
  fallback: ReactNode;
  badgeBgColor?: string;
  labelText: string;
  size?: "sm" | "md" | "lg";
};

export const AvatarWithLabel = ({
  image,
  fallback,
  labelText,
  badgeBgColor,
  size = "md",
}: AvatarWithLabelProps) => {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const labelSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className="relative inline-block">
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={image} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          `absolute -bottom-1 -right-1 bg-secondary text-primary-foreground rounded-full ${labelSizeClasses[size]} font-semibold flex items-center justify-center`,
        )}
        style={{
          backgroundColor: badgeBgColor,
          width: size === "sm" ? "16px" : size === "md" ? "20px" : "24px",
          height: size === "sm" ? "16px" : size === "md" ? "20px" : "24px",
          fontSize: size === "sm" ? "10px" : size === "md" ? "12px" : "14px",
        }}
      >
        {labelText}
      </span>
    </div>
  );
};
