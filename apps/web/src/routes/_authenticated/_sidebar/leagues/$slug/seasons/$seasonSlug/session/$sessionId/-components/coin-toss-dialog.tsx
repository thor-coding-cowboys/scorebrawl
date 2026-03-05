import { useState, useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Crown02Icon, FireIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { getPlayerById } from "./session-utils";
import type { GameSession, CoinTossPhase } from "./session-types";
import "./coin-toss-dialog.css";

export function CoinTossDialog({
	open,
	candidates,
	session,
	onResolve,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	candidates: string[];
	session: GameSession;
	onResolve: (winnerId: string) => void;
}) {
	const [phase, setPhase] = useState<CoinTossPhase>("pick");
	const [pickerChoice, setPickerChoice] = useState<"heads" | "tails" | null>(null);
	const [winnerId, setWinnerId] = useState<string | null>(null);
	const [spinDeg, setSpinDeg] = useState(0);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
		};
	}, []);

	useEffect(() => {
		if (open) {
			for (const t of timersRef.current) clearTimeout(t);
			timersRef.current = [];
			setPhase("pick");
			setPickerChoice(null);
			setWinnerId(null);
			setSpinDeg(0);
		}
	}, [open]);

	if (!open) return null;

	const picker = candidates[0] ? getPlayerById(session, candidates[0]) : undefined;
	const other = candidates[1] ? getPlayerById(session, candidates[1]) : undefined;

	const handlePick = (choice: "heads" | "tails") => {
		setPickerChoice(choice);
		setPhase("flip");

		const actualWinner = candidates[Math.floor(Math.random() * candidates.length)];
		const landedOn: "heads" | "tails" = actualWinner === candidates[0] ? "heads" : "tails";

		const baseSpins = 2520;
		const finalAngle = landedOn === "heads" ? 0 : 180;
		const totalDeg = baseSpins + finalAngle;
		setSpinDeg(totalDeg);

		timersRef.current.push(
			setTimeout(() => {
				setWinnerId(actualWinner);
				setPhase("result");
				timersRef.current.push(
					setTimeout(() => {
						onResolve(actualWinner);
					}, 2200)
				);
			}, 2800)
		);
	};

	const pickerName = picker?.displayName ?? "Player 1";
	const otherName = other?.displayName ?? "Player 2";
	const winnerName = winnerId ? (getPlayerById(session, winnerId)?.displayName ?? winnerId) : "";
	const winnerIsHeads = winnerId === candidates[0];

	return (
		<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
			{phase === "pick" && (
				<div className="flex flex-col items-center gap-8 px-6 max-w-sm w-full text-center">
					<div className="flex flex-col gap-1">
						<p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
							Coin Toss
						</p>
						<h2 className="text-2xl font-bold">{pickerName}</h2>
						<p className="text-sm text-muted-foreground">Pick a side</p>
					</div>

					<div className="flex gap-4 w-full">
						<button
							type="button"
							onClick={() => handlePick("heads")}
							className="flex-1 flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
						>
							<div className="coin-scene">
								<div className="coin-body" style={{ width: 72, height: 72 }}>
									<div
										className="coin-face coin-face-heads"
										style={{ inset: 0, width: 72, height: 72 }}
									>
										<HugeiconsIcon icon={Crown02Icon} className="size-7" />
									</div>
								</div>
							</div>
							<div>
								<p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
									Heads
								</p>
								<p className="text-sm font-semibold truncate max-w-[100px]">{pickerName}</p>
							</div>
						</button>

						<button
							type="button"
							onClick={() => handlePick("tails")}
							className="flex-1 flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group"
						>
							<div className="coin-scene">
								<div
									className="coin-face coin-face-tails"
									style={{
										position: "relative",
										width: 72,
										height: 72,
										transform: "none",
									}}
								>
									<HugeiconsIcon icon={FireIcon} className="size-7" />
								</div>
							</div>
							<div>
								<p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
									Tails
								</p>
								<p className="text-sm font-semibold truncate max-w-[100px]">
									{otherName || "Other"}
								</p>
							</div>
						</button>
					</div>

					<p className="text-xs text-muted-foreground font-mono">
						{pickerName} picks · winner plays next
					</p>
				</div>
			)}

			{phase === "flip" && (
				<div className="flex flex-col items-center gap-8">
					<p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
						Flipping...
					</p>
					<div
						className="coin-scene"
						style={{ "--coin-spin-end": `${spinDeg}deg` } as React.CSSProperties}
					>
						<div className="coin-body coin-spinning" style={{ width: 160, height: 160 }}>
							<div className="coin-face coin-face-heads" style={{ width: 160, height: 160 }}>
								<span className="coin-label">Heads</span>
								<span className="coin-name">{pickerName}</span>
								<HugeiconsIcon icon={Crown02Icon} className="size-8" />
							</div>
							<div className="coin-face coin-face-tails" style={{ width: 160, height: 160 }}>
								<span className="coin-label">Tails</span>
								<span className="coin-name">{otherName || "—"}</span>
								<HugeiconsIcon icon={FireIcon} className="size-8" />
							</div>
						</div>
					</div>
					<p className="text-sm text-muted-foreground font-mono">
						{pickerName} picked {pickerChoice}
					</p>
				</div>
			)}

			{phase === "result" && (
				<div className="flex flex-col items-center gap-6 text-center px-6">
					<p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
						Winner
					</p>
					<div
						className={cn("coin-face", winnerIsHeads ? "coin-face-heads" : "coin-face-tails")}
						style={{
							position: "relative",
							width: 160,
							height: 160,
							transform: "none",
						}}
					>
						<span className="coin-label">{winnerIsHeads ? "Heads" : "Tails"}</span>
						<span className="coin-name">{winnerName}</span>
						<HugeiconsIcon icon={winnerIsHeads ? Crown02Icon : FireIcon} className="size-8" />
					</div>
					<div className="flex flex-col gap-1">
						<h2 className="text-3xl font-bold tracking-tight">{winnerName}</h2>
						<p className="text-sm text-muted-foreground font-mono">plays next · closing...</p>
					</div>
				</div>
			)}
		</div>
	);
}
