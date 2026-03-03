import { useCallback, useEffect, useRef, useState } from "react";

type CoinSide = "heads" | "tails";

interface UseCoinTossReturn {
	visible: boolean;
	result: CoinSide | null;
	dismiss: () => void;
}

function randomCoinSide(): CoinSide {
	return Math.random() < 0.5 ? "heads" : "tails";
}

export function useCoinToss(): UseCoinTossReturn {
	const [visible, setVisible] = useState(false);
	const [result, setResult] = useState<CoinSide | null>(null);

	const visibleRef = useRef(false);
	visibleRef.current = visible;

	const trigger = useCallback(() => {
		if (visibleRef.current) return;
		setResult(randomCoinSide());
		setVisible(true);
	}, []);

	const dismiss = useCallback(() => {
		setVisible(false);
		setResult(null);
	}, []);

	// Triple-F keypress (desktop)
	useEffect(() => {
		const timestamps: number[] = [];

		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== "f" && e.key !== "F") return;
			const now = Date.now();
			timestamps.push(now);
			const cutoff = now - 800;
			while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
				timestamps.shift();
			}
			if (timestamps.length >= 3) {
				timestamps.length = 0;
				trigger();
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [trigger]);

	// 2-finger double-tap (mobile) — fires when two fingers touch twice within 400ms
	useEffect(() => {
		let lastTwoFingerTap = 0;

		function onTouchStart(e: TouchEvent) {
			if (e.touches.length !== 2) return;
			const now = Date.now();
			if (now - lastTwoFingerTap < 400) {
				trigger();
				lastTwoFingerTap = 0;
			} else {
				lastTwoFingerTap = now;
			}
		}

		window.addEventListener("touchstart", onTouchStart, { passive: true });
		return () => window.removeEventListener("touchstart", onTouchStart);
	}, [trigger]);

	return { visible, result, dismiss };
}
