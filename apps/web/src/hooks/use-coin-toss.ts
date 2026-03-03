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

	// Use a ref so shake/keypress handlers always see current value
	// without needing to re-register listeners on every state change.
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

	// Triple-F keypress detection
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

	// Shake detection via DeviceMotion
	useEffect(() => {
		const SHAKE_THRESHOLD = 18;
		const SHAKE_COOLDOWN_MS = 1500;

		let lastX = 0;
		let lastY = 0;
		let lastZ = 0;
		let lastShake = 0;
		let initialized = false;

		function onMotion(e: DeviceMotionEvent) {
			const acc = e.accelerationIncludingGravity;
			if (!acc) return;

			const x = acc.x ?? 0;
			const y = acc.y ?? 0;
			const z = acc.z ?? 0;

			if (!initialized) {
				lastX = x;
				lastY = y;
				lastZ = z;
				initialized = true;
				return;
			}

			const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
			lastX = x;
			lastY = y;
			lastZ = z;

			const now = Date.now();
			if (delta > SHAKE_THRESHOLD && now - lastShake > SHAKE_COOLDOWN_MS) {
				lastShake = now;
				trigger();
			}
		}

		function attachMotionListener() {
			window.addEventListener("devicemotion", onMotion);
		}

		if (typeof DeviceMotionEvent === "undefined") return;

		// iOS 13+ requires explicit user-gesture permission.
		// We request it on the first user tap so the prompt appears naturally.
		if ("requestPermission" in DeviceMotionEvent) {
			let granted = false;

			async function requestAndAttach() {
				if (granted) return;
				try {
					const state = await (
						DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
					).requestPermission();
					if (state === "granted") {
						granted = true;
						attachMotionListener();
					}
				} catch {
					// Permission denied or browser prevented the call
				}
			}

			window.addEventListener("click", requestAndAttach, { once: true });

			return () => {
				window.removeEventListener("click", requestAndAttach);
				window.removeEventListener("devicemotion", onMotion);
			};
		}

		// Android / non-permission browsers — attach directly
		attachMotionListener();
		return () => window.removeEventListener("devicemotion", onMotion);
	}, [trigger]);

	return { visible, result, dismiss };
}
