"use client";

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
import { ArrowReloadHorizontalIcon, BalanceScaleIcon, Tick01Icon, SortingAZ01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export interface PlayerSelectItem {
	id: string;
	name: string;
	image: string | null;
	score: string | number;
	team?: "home" | "away";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlayerSelectCallback = (player: any) => void;

interface PlayerSelectionDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	players: PlayerSelectItem[];
	onPlayerSelect: PlayerSelectCallback;
	onShuffle: () => void;
	onShuffleSelected?: () => void;
	onEven: () => void;
	onRotation?: () => void;
	canReorder: boolean;
	title?: string;
	emptyMessage?: string;
}

export function PlayerSelectionDrawer({
	isOpen,
	onClose,
	players,
	onPlayerSelect,
	onShuffle,
	onShuffleSelected,
	onEven,
	onRotation,
	canReorder,
	title = "Select Players",
	emptyMessage = "No players available",
}: PlayerSelectionDrawerProps) {
	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DrawerContent className="max-h-[85vh]" data-testid="player-selection-drawer">
				<div className="mx-auto w-full max-w-xl">
					<DrawerHeader className="border-b border-border pb-3">
						<DrawerTitle className="text-sm font-bold font-mono text-center">
							{title}
						</DrawerTitle>
					</DrawerHeader>

					<div className="grid grid-cols-2 gap-0 max-h-[55vh] overflow-y-auto">
						<div className="border-r border-border" data-testid="player-selection-home-column">
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
									Home
								</span>
							</div>
							<PlayerList team="home" players={players} onSelect={onPlayerSelect} emptyMessage={emptyMessage} />
						</div>

						<div data-testid="player-selection-away-column">
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
									Away
								</span>
							</div>
							<PlayerList team="away" players={players} onSelect={onPlayerSelect} emptyMessage={emptyMessage} />
						</div>
					</div>

					<Separator />

					<DrawerFooter className="flex-row items-center justify-between">
						<div className="flex gap-1.5">
							{onRotation && (
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
								data-testid="match-shuffle-button"
							>
								<HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-3.5" />
								<span className="hidden sm:inline">Shuffle</span>
							</Button>
							{onShuffleSelected && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={!canReorder}
									onClick={onShuffleSelected}
									className="gap-1"
									data-testid="match-shuffle-selected-button"
								>
									<HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-3.5" />
									<span className="hidden sm:inline">Shuffle Sel.</span>
								</Button>
							)}
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!canReorder}
								onClick={onEven}
								className="gap-1"
								data-testid="match-even-button"
							>
								<HugeiconsIcon icon={BalanceScaleIcon} className="size-3.5" />
								<span className="hidden sm:inline">Even</span>
							</Button>
						</div>
						<GlowButton
							glowColor={glowColors.blue}
							size="sm"
							onClick={onClose}
							icon={Tick01Icon}
							data-testid="match-done-button"
						>
							Done
						</GlowButton>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

interface PlayerListProps {
	team: "home" | "away";
	players: PlayerSelectItem[];
	onSelect: (player: { id: string; team?: "home" | "away" }) => void;
	emptyMessage?: string;
}

function PlayerList({ team, players, onSelect, emptyMessage = "No players" }: PlayerListProps) {
	const handleClick = (player: PlayerSelectItem) => {
		onSelect({
			id: player.id,
			team: player.team === team ? undefined : team,
		});
	};

	return (
		<div className="flex flex-col">
			{players.map((p) => {
				const isOnThisTeam = p.team === team;

				return (
					<button
						key={p.id}
						type="button"
						onClick={() => handleClick(p)}
						data-testid={`player-item-${p.id}`}
						className={cn(
							"flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/50 last:border-b-0",
							isOnThisTeam && "bg-primary/10 border-l-2 border-l-primary",
							!isOnThisTeam && "hover:bg-muted/50"
						)}
					>
						<AvatarWithFallback src={p.image} name={p.name} size="sm" />
						<div className="min-w-0 flex-1">
							<p className="text-xs font-medium truncate">{p.name}</p>
							<p className="text-[0.65rem] text-muted-foreground font-mono">{p.score}</p>
						</div>
						{isOnThisTeam && (
							<HugeiconsIcon icon={Tick01Icon} className="size-3.5 text-primary shrink-0" />
						)}
					</button>
				);
			})}
			{players.length === 0 && (
				<div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
					{emptyMessage}
				</div>
			)}
		</div>
	);
}
