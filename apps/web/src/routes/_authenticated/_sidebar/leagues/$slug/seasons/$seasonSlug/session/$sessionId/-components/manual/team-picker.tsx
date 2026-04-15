import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Home07Icon, AirplaneTakeOff01Icon } from "@hugeicons/core-free-icons";
import type { SessionPlayer, TeamAssignment } from "../session-types";

export type TeamPickerProps = {
	players: SessionPlayer[];
	teamAssignment: Map<string, TeamAssignment>;
	onAssignPlayer: (playerId: string, team: TeamAssignment) => void;
	teamSize: number;
};

export function TeamPicker({ players, teamAssignment, onAssignPlayer, teamSize }: TeamPickerProps) {
	const homePlayers = players.filter((p) => teamAssignment.get(p.id) === "home");
	const awayPlayers = players.filter((p) => teamAssignment.get(p.id) === "away");
	const unassignedPlayers = players.filter((p) => !teamAssignment.get(p.id));

	const handleAssign = (playerId: string, team: TeamAssignment) => {
		onAssignPlayer(playerId, team);
	};

	const isHomeFull = homePlayers.length >= teamSize;
	const isAwayFull = awayPlayers.length >= teamSize;

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div className="border border-border">
				<div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
					<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
						Home
					</span>
					<span className="text-xs font-mono text-muted-foreground">
						{homePlayers.length}/{teamSize}
					</span>
				</div>
				<div className="p-2 min-h-32">
					{homePlayers.length === 0 ? (
						<div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
							Click player to assign
						</div>
					) : (
						<div className="flex flex-col gap-1">
							{homePlayers.map((p) => (
								<div key={p.id} className="flex items-center gap-2 px-1 py-0.5 bg-blue-500/5">
									<AvatarWithFallback src={p.playerImage} name={p.displayName} size="sm" />
									<div className="min-w-0 flex-1">
										<p className="text-xs font-medium truncate">{p.displayName}</p>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => handleAssign(p.id, undefined)}
										className="h-6 w-6 text-muted-foreground hover:text-destructive"
									>
										×
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<div className="border border-border">
				<div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-center">
					<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
						Unassigned
					</span>
				</div>
				<div className="p-2 min-h-32">
					{unassignedPlayers.length === 0 ? (
						<div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
							All players assigned
						</div>
					) : (
						<div className="flex flex-col gap-1">
							{unassignedPlayers.map((p) => (
								<div key={p.id} className="flex items-center gap-2 px-1 py-0.5">
									<AvatarWithFallback src={p.playerImage} name={p.displayName} size="sm" />
									<div className="min-w-0 flex-1">
										<p className="text-xs font-medium truncate">{p.displayName}</p>
										<p className="text-[0.65rem] text-muted-foreground font-mono">{p.score} pts</p>
									</div>
									<div className="flex gap-1">
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onClick={() => handleAssign(p.id, "home")}
											disabled={isHomeFull}
											className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
											title="Assign to Home"
										>
											<HugeiconsIcon icon={Home07Icon} className="size-3.5" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											onClick={() => handleAssign(p.id, "away")}
											disabled={isAwayFull}
											className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-500/10"
											title="Assign to Away"
										>
											<HugeiconsIcon icon={AirplaneTakeOff01Icon} className="size-3.5" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<div className="border border-border">
				<div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
					<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
						Away
					</span>
					<span className="text-xs font-mono text-muted-foreground">
						{awayPlayers.length}/{teamSize}
					</span>
				</div>
				<div className="p-2 min-h-32">
					{awayPlayers.length === 0 ? (
						<div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
							Click player to assign
						</div>
					) : (
						<div className="flex flex-col gap-1">
							{awayPlayers.map((p) => (
								<div key={p.id} className="flex items-center gap-2 px-1 py-0.5 bg-red-500/5">
									<AvatarWithFallback src={p.playerImage} name={p.displayName} size="sm" />
									<div className="min-w-0 flex-1">
										<p className="text-xs font-medium truncate">{p.displayName}</p>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => handleAssign(p.id, undefined)}
										className="h-6 w-6 text-muted-foreground hover:text-destructive"
									>
										×
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
