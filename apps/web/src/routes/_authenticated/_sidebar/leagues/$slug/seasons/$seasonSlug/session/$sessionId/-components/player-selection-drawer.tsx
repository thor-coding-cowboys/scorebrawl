import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowReloadHorizontalIcon,
	BalanceScaleIcon,
	SortingAZ01Icon,
	Tick01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { GameSession, PlayerWithTeam } from "./session-types";

export function PlayerSelectionDrawer({
	isOpen,
	onClose,
	session,
	teamAssignment,
	onSelect,
	onShuffle,
	onEven,
	onRotation,
	canReorder,
	isFirstMatch,
}: {
	isOpen: boolean;
	onClose: () => void;
	session: GameSession;
	teamAssignment: PlayerWithTeam[];
	onSelect: (player: PlayerWithTeam, team: "home" | "away") => void;
	onShuffle: () => void;
	onEven: () => void;
	onRotation: () => void;
	canReorder: boolean;
	isFirstMatch: boolean;
}) {
	return (
		<Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DrawerContent className="max-h-[85vh]">
				<div className="mx-auto w-full max-w-xl">
					<DrawerHeader className="border-b border-border pb-3">
						<DrawerTitle className="text-sm font-bold font-mono text-center">
							Select Players
						</DrawerTitle>
					</DrawerHeader>

					<div className="grid grid-cols-2 gap-0 max-h-[55vh] overflow-y-auto">
						<div className="border-r border-border">
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
									Home
								</span>
							</div>
							<PlayerColumnList
								team="home"
								players={teamAssignment}
								teamSize={session.teamSize}
								onSelect={onSelect}
							/>
						</div>
						<div>
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
									Away
								</span>
							</div>
							<PlayerColumnList
								team="away"
								players={teamAssignment}
								teamSize={session.teamSize}
								onSelect={onSelect}
							/>
						</div>
					</div>

					<Separator />

					<DrawerFooter className="flex-row items-center justify-between">
						<div className="flex gap-1.5">
							{isFirstMatch && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={onRotation}
									className="gap-1"
								>
									<HugeiconsIcon icon={SortingAZ01Icon} className="size-3.5" />
									<span className="hidden sm:inline">Rotation</span>
								</Button>
							)}
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!canReorder}
								onClick={onShuffle}
								className="gap-1"
							>
								<HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-3.5" />
								<span className="hidden sm:inline">Shuffle</span>
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!canReorder}
								onClick={onEven}
								className="gap-1"
							>
								<HugeiconsIcon icon={BalanceScaleIcon} className="size-3.5" />
								<span className="hidden sm:inline">Even</span>
							</Button>
						</div>
						<GlowButton glowColor={glowColors.blue} size="sm" onClick={onClose} icon={Tick01Icon}>
							Done
						</GlowButton>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

export function PlayerColumnList({
	team,
	players,
	teamSize,
	onSelect,
}: {
	team: "home" | "away";
	players: PlayerWithTeam[];
	teamSize: number;
	onSelect: (player: PlayerWithTeam, team: "home" | "away") => void;
}) {
	const selectedForThisTeam = players.filter((p) => p.team === team).length;
	const isFull = selectedForThisTeam >= teamSize;

	return (
		<div className="flex flex-col">
			{players.map((p) => {
				const isOnThisTeam = p.team === team;
				const isOnOtherTeam = p.team !== undefined && p.team !== team;
				const isDisabled = isOnOtherTeam || (!isOnThisTeam && isFull);

				return (
					<button
						key={p.id}
						type="button"
						disabled={isDisabled}
						onClick={() => onSelect(p, team)}
						className={cn(
							"flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/50 last:border-b-0",
							isOnThisTeam && "bg-primary/10 border-l-2 border-l-primary",
							isOnOtherTeam && "opacity-40",
							isDisabled && !isOnOtherTeam && "opacity-40",
							!isDisabled && !isOnThisTeam && "hover:bg-muted/50"
						)}
					>
						<AvatarWithFallback src={p.playerImage} name={p.displayName} size="sm" />
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium truncate">{p.displayName}</p>
							<p className="text-[0.65rem] text-muted-foreground font-mono">{p.score}</p>
						</div>
						{isOnThisTeam && (
							<HugeiconsIcon icon={Tick01Icon} className="size-3.5 text-primary shrink-0" />
						)}
					</button>
				);
			})}
		</div>
	);
}
