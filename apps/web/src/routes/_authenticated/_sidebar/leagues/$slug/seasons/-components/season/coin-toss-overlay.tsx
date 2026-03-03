import { useEffect, useRef, useState } from "react";

type CoinSide = "heads" | "tails";

interface CoinTossOverlayProps {
	visible: boolean;
	result: CoinSide | null;
	onDone: () => void;
}

export function CoinTossOverlay({ visible, result, onDone }: CoinTossOverlayProps) {
	const [phase, setPhase] = useState<"hidden" | "spinning" | "reveal">("hidden");
	const onDoneRef = useRef(onDone);
	onDoneRef.current = onDone;

	useEffect(() => {
		if (!visible || result === null) return;

		setPhase("spinning");

		const revealTimer = setTimeout(() => setPhase("reveal"), 1400);
		const doneTimer = setTimeout(() => {
			setPhase("hidden");
			onDoneRef.current();
		}, 3400);

		return () => {
			clearTimeout(revealTimer);
			clearTimeout(doneTimer);
		};
	}, [visible, result]);

	if (phase === "hidden") return null;

	// The coin uses a single rotateY animation on the wrapper.
	// Each face uses scaleX(-1) correction so text never mirrors.
	// We use two separate animations — one for the wrapper rotation,
	// and face visibility is handled purely by the rotation angle
	// (front face visible 0-90deg and 270-360deg, back face 90-270deg).
	// Since backface-visibility can be unreliable on iOS Safari, we instead
	// use a single flat coin that swaps appearance at the halfway point
	// using an animation that changes background/content at 50%.

	const isHeads = result === "heads";

	// Spin animation name encodes the result so the keyframe lands on the
	// correct face: heads lands at 0 mod 360 (front), tails at 180 mod 360 (back).
	const spinName = isHeads ? "coinSpinHeads" : "coinSpinTails";
	const landName = isHeads ? "coinLandHeads" : "coinLandTails";

	return (
		<div
			className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
			style={{
				background: "rgba(0,0,0,0.85)",
				WebkitBackdropFilter: "blur(8px)",
				backdropFilter: "blur(8px)",
			}}
		>
			<div className="flex flex-col items-center gap-8">
				{/* Coin */}
				<div style={{ width: 140, height: 140, position: "relative" }}>
					{/* The coin is a single flat circle. We animate it with scaleX to simulate
					    a flip — this is the most reliable technique on iOS Safari.
					    At scaleX=0 (midpoint) we swap the face via a CSS class trick using
					    animation-name on a separate overlay element. */}
					<div
						style={{
							width: "100%",
							height: "100%",
							borderRadius: "50%",
							position: "relative",
							animation:
								phase === "spinning"
									? `${spinName} 1.4s cubic-bezier(0.33,0,0.2,1) forwards`
									: `${landName} 0.3s ease-out forwards`,
						}}
					>
						{/* Heads layer */}
						<div
							style={{
								position: "absolute",
								inset: 0,
								borderRadius: "50%",
								background:
									"radial-gradient(circle at 35% 30%, #fef3c7, #f59e0b 50%, #b45309 100%)",
								boxShadow:
									"0 0 0 5px #d97706, inset 0 3px 8px rgba(255,255,255,0.4), 0 12px 40px rgba(245,158,11,0.6)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								animation:
									phase === "spinning"
										? `${spinName}HeadsFace 1.4s cubic-bezier(0.33,0,0.2,1) forwards`
										: undefined,
							}}
						>
							<span style={{ fontSize: 60, lineHeight: 1 }}>👑</span>
						</div>
						{/* Tails layer — sits on top, hidden at start, revealed at midpoint */}
						<div
							style={{
								position: "absolute",
								inset: 0,
								borderRadius: "50%",
								background:
									"radial-gradient(circle at 35% 30%, #f1f5f9, #94a3b8 50%, #475569 100%)",
								boxShadow:
									"0 0 0 5px #64748b, inset 0 3px 8px rgba(255,255,255,0.3), 0 12px 40px rgba(100,116,139,0.5)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								animation:
									phase === "spinning"
										? `${spinName}TailsFace 1.4s cubic-bezier(0.33,0,0.2,1) forwards`
										: undefined,
							}}
						>
							<span style={{ fontSize: 60, lineHeight: 1 }}>⚔️</span>
						</div>
					</div>
				</div>

				{/* Result label */}
				{phase === "reveal" && result && (
					<div style={{ animation: "coinRevealLabel 0.35s ease-out forwards", opacity: 0 }}>
						<span
							style={{
								fontSize: "2.5rem",
								fontWeight: 900,
								letterSpacing: "0.08em",
								textTransform: "uppercase",
								color: isHeads ? "#fbbf24" : "#cbd5e1",
								textShadow: isHeads
									? "0 0 24px rgba(251,191,36,0.7), 0 2px 4px rgba(0,0,0,0.5)"
									: "0 0 24px rgba(203,213,225,0.5), 0 2px 4px rgba(0,0,0,0.5)",
							}}
						>
							{result}
						</span>
					</div>
				)}
			</div>

			<style>{`
        /*
         * Strategy: animate scaleX on the coin wrapper (1 → 0 → 1, repeating).
         * Each half-cycle = one face. We use opacity on each face layer to show
         * the correct face during each half. This avoids backface-visibility entirely.
         *
         * Heads result: lands showing heads face (scaleX ends at 1, heads visible)
         * Tails result: lands showing tails face (scaleX ends at 1, tails visible)
         *
         * We do 3 full flips (6 half-cycles) before landing.
         */

        /* --- HEADS result --- */
        @keyframes coinSpinHeads {
          0%   { transform: scaleX(1)  scaleY(0.85); opacity: 0; }
          4%   { opacity: 1; }
          /* 6 half-flips, each ~15.3% of 1.4s */
          16%  { transform: scaleX(0)  scaleY(1); }
          33%  { transform: scaleX(1)  scaleY(0.9); }
          50%  { transform: scaleX(0)  scaleY(1); }
          66%  { transform: scaleX(1)  scaleY(0.92); }
          83%  { transform: scaleX(0)  scaleY(1); }
          100% { transform: scaleX(1)  scaleY(1); opacity: 1; }
        }
        /* Heads face: visible when scaleX > 0 on even cycles, hidden on odd */
        @keyframes coinSpinHeadsHeadsFace {
          0%   { opacity: 1; }
          15%  { opacity: 1; }
          16%  { opacity: 0; } /* hide at first midpoint */
          32%  { opacity: 0; }
          33%  { opacity: 1; } /* show at second midpoint */
          49%  { opacity: 1; }
          50%  { opacity: 0; }
          65%  { opacity: 0; }
          66%  { opacity: 1; }
          82%  { opacity: 1; }
          83%  { opacity: 0; }
          99%  { opacity: 0; }
          100% { opacity: 1; } /* land on heads */
        }
        /* Tails face: opposite of heads face */
        @keyframes coinSpinHeadsTailsFace {
          0%   { opacity: 0; }
          15%  { opacity: 0; }
          16%  { opacity: 1; }
          32%  { opacity: 1; }
          33%  { opacity: 0; }
          49%  { opacity: 0; }
          50%  { opacity: 1; }
          65%  { opacity: 1; }
          66%  { opacity: 0; }
          82%  { opacity: 0; }
          83%  { opacity: 1; }
          99%  { opacity: 1; }
          100% { opacity: 0; } /* land on heads, so tails hidden */
        }

        /* --- TAILS result --- */
        @keyframes coinSpinTails {
          0%   { transform: scaleX(1)  scaleY(0.85); opacity: 0; }
          4%   { opacity: 1; }
          16%  { transform: scaleX(0)  scaleY(1); }
          33%  { transform: scaleX(1)  scaleY(0.9); }
          50%  { transform: scaleX(0)  scaleY(1); }
          66%  { transform: scaleX(1)  scaleY(0.92); }
          83%  { transform: scaleX(0)  scaleY(1); }
          100% { transform: scaleX(1)  scaleY(1); opacity: 1; }
        }
        /* Tails face: visible on odd half-cycles, hidden on even — lands showing tails */
        @keyframes coinSpinTailsTailsFace {
          0%   { opacity: 0; }
          15%  { opacity: 0; }
          16%  { opacity: 1; }
          32%  { opacity: 1; }
          33%  { opacity: 0; }
          49%  { opacity: 0; }
          50%  { opacity: 1; }
          65%  { opacity: 1; }
          66%  { opacity: 0; }
          82%  { opacity: 0; }
          83%  { opacity: 1; }
          100% { opacity: 1; } /* land on tails */
        }
        @keyframes coinSpinTailsHeadsFace {
          0%   { opacity: 1; }
          15%  { opacity: 1; }
          16%  { opacity: 0; }
          32%  { opacity: 0; }
          33%  { opacity: 1; }
          49%  { opacity: 1; }
          50%  { opacity: 0; }
          65%  { opacity: 0; }
          66%  { opacity: 1; }
          82%  { opacity: 1; }
          83%  { opacity: 0; }
          100% { opacity: 0; } /* land on tails, heads hidden */
        }

        /* --- Land bounce --- */
        @keyframes coinLandHeads {
          0%   { transform: scaleX(1) scaleY(1); }
          40%  { transform: scaleX(1.12) scaleY(0.92); }
          70%  { transform: scaleX(0.95) scaleY(1.06); }
          100% { transform: scaleX(1) scaleY(1); }
        }
        @keyframes coinLandTails {
          0%   { transform: scaleX(1) scaleY(1); }
          40%  { transform: scaleX(1.12) scaleY(0.92); }
          70%  { transform: scaleX(0.95) scaleY(1.06); }
          100% { transform: scaleX(1) scaleY(1); }
        }

        @keyframes coinRevealLabel {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
		</div>
	);
}
