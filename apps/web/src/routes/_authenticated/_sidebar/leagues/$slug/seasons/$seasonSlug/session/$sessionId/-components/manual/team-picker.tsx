import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlayerWithTeam, TeamAssignment } from "../session-types";

interface TeamPickerProps {
	players: PlayerWithTeam[];
	teamSize: number;
	disabled?: boolean;
	onAssignPlayer: (playerId: string, team: TeamAssignment) => void;
}

export function TeamPicker({ players, teamSize, disabled, onAssignPlayer }: TeamPickerProps) {
	const eligible = players.filter((p) => p.status !== "out");
	const homePlayers = players.filter((p) => p.team === "home");
	const awayPlayers = players.filter((p) => p.team === "away");
	const homeCount = homePlayers.length;
	const awayCount = awayPlayers.length;

	const handleClick = (player: PlayerWithTeam) => {
		if (disabled) return;
		if (player.team === "home") {
			onAssignPlayer(player.id, undefined);
		} else if (player.team === "away") {
			onAssignPlayer(player.id, undefined);
		} else if (homeCount < teamSize) {
			onAssignPlayer(player.id, "home");
		} else if (awayCount < teamSize) {
			onAssignPlayer(player.id, "away");
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="grid grid-cols-2 gap-3">
				<TeamSlot
					label="Home"
					players={homePlayers}
					teamSize={teamSize}
					onRemove={(id) => onAssignPlayer(id, undefined)}
					disabled={disabled}
				/>
				<TeamSlot
					label="Away"
					players={awayPlayers}
					teamSize={teamSize}
					onRemove={(id) => onAssignPlayer(id, undefined)}
					disabled={disabled}
				/>
			</div>
			<div className="text-xs text-muted-foreground font-mono mb-1">Available</div>
			<div className="flex flex-col gap-1">
				{eligible
					.filter((p) => !p.team)
					.map((p) => (
						<Button
							key={p.id}
							variant="outline"
							className="w-full justify-start gap-2 h-9"
							disabled={disabled || (homeCount >= teamSize && awayCount >= teamSize)}
							onClick={() => handleClick(p)}
						>
							<AvatarWithFallback
								src={p.playerImage ?? undefined}
								name={p.displayName}
								className="size-6"
							/>
							<span className="text-sm">{p.displayName}</span>
							<span className="ml-auto text-xs text-muted-foreground tabular-nums">
								{p.score.toFixed(0)}
							</span>
						</Button>
					))}
			</div>
		</div>
	);
}

function TeamSlot({
	label,
	players,
	teamSize,
	onRemove,
	disabled,
}: {
	label: string;
	players: PlayerWithTeam[];
	teamSize: number;
	onRemove: (id: string) => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1">
			<div className="text-xs text-muted-foreground font-mono mb-1">{label}</div>
			{Array.from({ length: teamSize }).map((_, i) => {
				const player = players[i];
				return (
					<div
						key={player?.id ?? `empty-${i}`}
						className={cn(
							"flex items-center gap-2 h-9 px-2 rounded-md border text-sm",
							player
								? "bg-muted/40 cursor-pointer hover:bg-destructive/10 hover:border-destructive/40"
								: "border-dashed text-muted-foreground"
						)}
						onClick={() => player && !disabled && onRemove(player.id)}
					>
						{player ? (
							<>
								<AvatarWithFallback
									src={player.playerImage ?? undefined}
									name={player.displayName}
									className="size-6"
								/>
								<span>{player.displayName}</span>
							</>
						) : (
							<span className="text-xs">Empty slot</span>
						)}
					</div>
				);
			})}
		</div>
	);
}
