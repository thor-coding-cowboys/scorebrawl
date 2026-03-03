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

const LONG_PRESS_MS = 600;

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

	// Long press (mobile) — no permissions needed
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		let startX = 0;
		let startY = 0;

		function onTouchStart(e: TouchEvent) {
			const touch = e.touches[0];
			startX = touch?.clientX ?? 0;
			startY = touch?.clientY ?? 0;
			timer = setTimeout(() => {
				trigger();
				timer = null;
			}, LONG_PRESS_MS);
		}

		function cancel(e: TouchEvent) {
			if (!timer) return;
			// Cancel if the finger moved more than 10px (it's a scroll, not a press)
			const touch = e.changedTouches[0];
			if (touch) {
				const dx = Math.abs(touch.clientX - startX);
				const dy = Math.abs(touch.clientY - startY);
				if (dx > 10 || dy > 10) {
					clearTimeout(timer);
					timer = null;
					return;
				}
			}
			clearTimeout(timer);
			timer = null;
		}

		function onTouchEnd() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		}

		window.addEventListener("touchstart", onTouchStart, { passive: true });
		window.addEventListener("touchmove", cancel, { passive: true });
		window.addEventListener("touchend", onTouchEnd, { passive: true });
		window.addEventListener("touchcancel", onTouchEnd, { passive: true });

		return () => {
			if (timer) clearTimeout(timer);
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", cancel);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("touchcancel", onTouchEnd);
		};
	}, [trigger]);

	return { visible, result, dismiss };
}
