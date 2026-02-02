import { AvatarWithFallback } from "@/components/avatar/avatar-with-fallback";
import { cn } from "@/lib/utils";
import type { PlayerWithSelection } from "./MatchForm";

export const PlayerSelection = ({
  team,
  players,
  onSelect,
}: {
  team: "home" | "away";
  players: PlayerWithSelection[];
  onSelect: (player: PlayerWithSelection) => void;
}) => {
  const handlePlayerSelection = (player: PlayerWithSelection) => {
    onSelect({ ...player, team: player.team === team ? undefined : team });
  };

  return (
    <div className="flex flex-col gap-0.5">
      {players.map((p) => (
        <button
          key={p.user.userId}
          onClick={() => handlePlayerSelection(p)}
          onKeyDown={(e) => e.key === "Enter" && handlePlayerSelection(p)}
          type="button"
          tabIndex={0}
          className={cn(
            "flex gap-2 items-center p-1 rounded-md",
            p.team ? (p.team === team ? "bg-primary/20" : "line-through") : "",
          )}
        >
          <AvatarWithFallback size="md" image={p.user.image} name={p.user.name} />
          <div className="grid auto-rows-min text-start">
            <p className="text-xs font-medium truncate">{p.user.name}</p>
            <p className="text-xs text-muted-foreground">{p.score}</p>
          </div>
        </button>
      ))}
    </div>
  );
};
