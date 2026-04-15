import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon, CheckmarkCircle01Icon, ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import type { SessionMatch, PlayerWithTeam } from "../session-types";

export function MatchActions({
	currentMatch,
	homePlayers,
	awayPlayers,
	onStartMatch,
	onRecordResult,
	onCancelMatch,
	isStarting,
	isRecording,
	isCanceling,
	disabled,
}: {
	currentMatch: SessionMatch | null;
	homePlayers: PlayerWithTeam[];
	awayPlayers: PlayerWithTeam[];
	onStartMatch: () => void;
	onRecordResult: () => void;
	onCancelMatch: () => void;
	isStarting: boolean;
	isRecording: boolean;
	isCanceling: boolean;
	disabled: boolean;
}) {
	if (currentMatch) {
		return (
			<div className="flex flex-col gap-2">
				<GlowButton
					glowColor={glowColors.blue}
					onClick={onRecordResult}
					disabled={isRecording || disabled}
					className="w-full gap-2"
				>
					<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
					{isRecording ? "Recording..." : disabled ? "Loading teams..." : "Record Result"}
				</GlowButton>
				<Button
					variant="ghost"
					size="sm"
					onClick={onCancelMatch}
					disabled={isCanceling}
					className="w-full gap-1.5 text-muted-foreground"
				>
					<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-4" />
					{isCanceling ? "Cancelling..." : "Cancel Match"}
				</Button>
			</div>
		);
	}

	const teamsBalanced = homePlayers.length === awayPlayers.length && homePlayers.length > 0;

	return (
		<GlowButton
			glowColor={glowColors.blue}
			onClick={onStartMatch}
			disabled={!teamsBalanced || disabled || isStarting}
			className="w-full gap-2"
		>
			<HugeiconsIcon icon={PlayIcon} className="size-4" />
			{isStarting ? "Starting..." : "Start Match"}
		</GlowButton>
	);
}