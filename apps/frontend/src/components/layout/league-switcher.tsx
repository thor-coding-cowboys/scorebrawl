// TODO: Implement resetLastVisitedLeague with tRPC mutation
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useSidebar } from "../ui/sidebar";

interface LeagueSwitcherProps {
  leagues: { id: string; slug: string; name: string; logoUrl: string | null }[];
  onLeagueSelect: (leagueId: string) => void;
}

export function LeagueSwitcher({ leagues, onLeagueSelect }: LeagueSwitcherProps) {
  const navigate = useNavigate();
  const { open, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !open && !isMobile;
  // TODO: Get leagueSlug from router params when league routes are defined
  const leagueSlug = undefined as string | undefined;

  const selectedLeague = leagues.find((league) => league.slug === leagueSlug) ?? leagues[0];
  return (
    <Select
      value={selectedLeague?.name}
      onValueChange={async (value: string) => {
        setOpenMobile(false);
        if (value === "create") {
          navigate({ to: "/leagues/create" });
        } else {
          // TODO: Call tRPC mutation for resetLastVisitedLeague
          onLeagueSelect(value);
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden",
        )}
        aria-label="Select League"
      >
        <SelectValue placeholder="Select a league">
          <Avatar className="h-6 w-6">
            <AvatarImage src={selectedLeague?.logoUrl ?? ""} />
            <AvatarFallback>{`${selectedLeague?.name.charAt(0).toUpperCase()}`}</AvatarFallback>
          </Avatar>
          <span className={cn("ml-1", isCollapsed && "hidden")}>{selectedLeague?.name}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-sidebar">
        <SelectGroup className="max-h-48 overflow-y-auto">
          <SelectLabel>Leagues</SelectLabel>
          {leagues.map((league) => (
            <SelectItem key={league.slug} value={league.slug}>
              <div className="flex items-center gap-2 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={league.logoUrl ?? ""} />
                  <AvatarFallback>{`${league.name.charAt(0).toUpperCase()}`}</AvatarFallback>
                </Avatar>
                {league.name}
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
        <Separator className="my-2" />
        <SelectGroup>
          <SelectItem className="mt-2 " value="create">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback>
                  <PlusIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              Create League
            </div>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
