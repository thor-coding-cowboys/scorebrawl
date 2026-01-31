import { cn } from "@/lib/utils";

export const Title = ({
  title,
  subtitle,
  className,
  titleClassName,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
}) => (
  <div className={className}>
    <h2 className={cn("text-xl font-bold tracking-tight", titleClassName)}>{title}</h2>
    {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
  </div>
);
