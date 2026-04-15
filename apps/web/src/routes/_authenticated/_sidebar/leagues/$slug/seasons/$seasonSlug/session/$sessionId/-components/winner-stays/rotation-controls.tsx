import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShuffleIcon } from "@hugeicons/core-free-icons";
import type { PlayerWithTeam } from "../session-types";

interface RotationControlsProps {
	teamAssignment: PlayerWithTeam[];
	onShuffle: () => void;
	onShuffleSelected: () => void;
	onEven: () => void;
	onRotation: (() => void) | undefined;
	isShuffling: boolean;
}

export function RotationControls({
	teamAssignment,
	onShuffle,
	onShuffleSelected,
	onEven,
	onRotation,
	isShuffling,
}: RotationControlsProps) {
	const selectedCount = teamAssignment.filter((p) => p.team).length;
	const canShuffleSelected = selectedCount >= 2;
	const showRotation = onRotation !== undefined;

	return (
		<div className="flex flex-wrap gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={onShuffle}
				disabled={isShuffling}
				className="gap-1.5"
			>
				<HugeiconsIcon icon={ShuffleIcon} className="size-4" />
				Shuffle
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={onShuffleSelected}
				disabled={isShuffling || !canShuffleSelected}
				className="gap-1.5"
			>
				<HugeiconsIcon icon={ShuffleIcon} className="size-4" />
				Shuffle Selected
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={onEven}
				disabled={isShuffling}
				className="gap-1.5"
			>
				Even
			</Button>
			{showRotation && (
				<Button
					variant="outline"
					size="sm"
					onClick={onRotation}
					disabled={isShuffling}
					className="gap-1.5"
				>
					Rotation
				</Button>
			)}
		</div>
	);
}
