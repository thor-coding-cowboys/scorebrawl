import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useId } from "react";
import { AvatarWithFallback } from "./avatar/avatar-with-fallback";

export type AvatarProps = { id: string; name: string; image?: string };
export const MultiAvatar = (
  {
    visibleCount,
    users,
  }: {
    visibleCount: number;
    users: AvatarProps[];
  } = { users: [], visibleCount: 5 },
) => {
  const avatarAndName = ({ id, name, image }: AvatarProps) => {
    return (
      <Tooltip key={id}>
        <TooltipTrigger className="flex">
          <AvatarWithFallback size="md" name={name} image={image} />
        </TooltipTrigger>
        <TooltipContent>
          <div className={"text-xs"}>{name}</div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const withRemainingCount = () => {
    const firstThree = users.slice(0, visibleCount - 1);
    const remainingCount = users.length - (visibleCount - 1);
    return (
      <>
        {firstThree.map((p) => avatarAndName(p))}
        <Avatar key="remaining" className={cn("h-8 w-8 text-sm")}>
          <AvatarFallback className="text-xs">{`+${remainingCount}`}</AvatarFallback>
        </Avatar>
      </>
    );
  };

  return (
    <div className={cn(users.length > 1 ? "flex -space-x-4" : "")}>
      {users.length <= visibleCount ? users.map(avatarAndName) : withRemainingCount()}
    </div>
  );
};

export const MultiAvatarWithSkeletonLoading = ({
  users,
  visibleCount = 3,
}: { users?: Array<AvatarProps>; visibleCount?: number }) => {
  if (!users) {
    return (
      <div className="flex space-x-4">
        {Array.from({ length: visibleCount }).map(() => (
          <Skeleton key={useId()} className="h-8 w-8" />
        ))}
      </div>
    );
  }
  return <MultiAvatar visibleCount={visibleCount} users={users} />;
};
