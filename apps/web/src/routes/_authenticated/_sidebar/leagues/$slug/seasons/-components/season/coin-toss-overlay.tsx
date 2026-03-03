import { useEffect, useState } from "react";

type CoinSide = "heads" | "tails";

interface CoinTossOverlayProps {
	visible: boolean;
	result: CoinSide | null;
	onDone: () => void;
}

export function CoinTossOverlay({ visible, result, onDone }: CoinTossOverlayProps) {
	const [phase, setPhase] = useState<"spinning" | "reveal" | "hidden">("hidden");

	useEffect(() => {
		if (!visible || result === null) return;

		setPhase("spinning");

		const revealTimer = setTimeout(() => {
			setPhase("reveal");
		}, 1400);

		const doneTimer = setTimeout(() => {
			setPhase("hidden");
			onDone();
		}, 3200);

		return () => {
			clearTimeout(revealTimer);
			clearTimeout(doneTimer);
		};
	}, [visible, result, onDone]);

	if (phase === "hidden") return null;

	// Each face animates independently so backface-visibility is respected.
	// Heads starts front (rotateY 0), tails starts back (rotateY 180deg).
	// Both spin the same amount so they stay in sync.
	const spinAnimation = "faceSpin 1.4s cubic-bezier(0.4,0,0.2,1) forwards";
	const headsLandAnimation =
		result === "heads"
			? "headsLandFront 0.25s ease-out forwards"
			: "headsLandBack 0.25s ease-out forwards";
	const tailsLandAnimation =
		result === "tails"
			? "tailsLandFront 0.25s ease-out forwards"
			: "tailsLandBack 0.25s ease-out forwards";

	const faceBase: React.CSSProperties = {
		position: "absolute",
		inset: 0,
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backfaceVisibility: "hidden",
		WebkitBackfaceVisibility: "hidden",
	};

	return (
		<div
			className="fixed inset-0 z-50 flex flex-col items-center justify-center"
			style={{
				background: "rgba(0,0,0,0.82)",
				backdropFilter: "blur(6px)",
				WebkitBackdropFilter: "blur(6px)",
			}}
		>
			<div className="flex flex-col items-center gap-6 select-none">
				<div
					style={{
						width: 120,
						height: 120,
						position: "relative",
						perspective: 600,
					}}
				>
					{/* Heads face — starts at rotateY(0deg) */}
					<div
						style={{
							...faceBase,
							background: "radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 55%, #b45309)",
							boxShadow:
								"0 0 0 4px #d97706, inset 0 2px 6px rgba(255,255,255,0.3), 0 8px 32px rgba(245,158,11,0.5)",
							animation: phase === "spinning" ? spinAnimation : headsLandAnimation,
						}}
					>
						<span style={{ fontSize: 52, lineHeight: 1 }}>👑</span>
					</div>

					{/* Tails face — starts at rotateY(180deg) so it's hidden initially */}
					<div
						style={{
							...faceBase,
							background: "radial-gradient(circle at 35% 35%, #d1d5db, #9ca3af 55%, #4b5563)",
							boxShadow:
								"0 0 0 4px #6b7280, inset 0 2px 6px rgba(255,255,255,0.2), 0 8px 32px rgba(107,114,128,0.4)",
							animation:
								phase === "spinning"
									? "tailsStartSpin 1.4s cubic-bezier(0.4,0,0.2,1) forwards"
									: tailsLandAnimation,
						}}
					>
						<span style={{ fontSize: 52, lineHeight: 1 }}>⚔️</span>
					</div>
				</div>

				{phase === "reveal" && result && (
					<div
						style={{
							animation: "fadeSlideUp 0.3s ease-out forwards",
							opacity: 0,
						}}
					>
						<span
							style={{
								fontSize: "2.25rem",
								fontWeight: 800,
								letterSpacing: "0.05em",
								textTransform: "uppercase",
								color: result === "heads" ? "#fbbf24" : "#d1d5db",
								textShadow:
									result === "heads"
										? "0 0 20px rgba(251,191,36,0.6)"
										: "0 0 20px rgba(209,213,219,0.4)",
							}}
						>
							{result}
						</span>
					</div>
				)}
			</div>

			<style>{`
        /* Heads face: starts at 0deg, spins to 1080deg (lands on heads = front) */
        @keyframes faceSpin {
          0%   { transform: rotateY(0deg) scale(0.7); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: rotateY(1080deg) scale(1); opacity: 1; }
        }
        /* Tails face: starts at 180deg, spins the same arc so it stays 180deg offset */
        @keyframes tailsStartSpin {
          0%   { transform: rotateY(180deg) scale(0.7); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: rotateY(1260deg) scale(1); opacity: 1; }
        }

        /* Land animations for heads face */
        @keyframes headsLandFront {
          from { transform: rotateY(1080deg) scale(1); }
          to   { transform: rotateY(1080deg) scale(1.08); }
        }
        @keyframes headsLandBack {
          from { transform: rotateY(1080deg) scale(1); }
          to   { transform: rotateY(1080deg) scale(1.08); }
        }

        /* Land animations for tails face */
        @keyframes tailsLandFront {
          from { transform: rotateY(1260deg) scale(1); }
          to   { transform: rotateY(1260deg) scale(1.08); }
        }
        @keyframes tailsLandBack {
          from { transform: rotateY(1260deg) scale(1); }
          to   { transform: rotateY(1260deg) scale(1.08); }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
		</div>
	);
}
