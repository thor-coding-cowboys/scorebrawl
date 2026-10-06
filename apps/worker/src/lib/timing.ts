const DEFAULT_SLOW_MS = 25;

/** Logs only when a DB phase crosses the slow threshold, so normal requests stay quiet. */
export function logDbTiming(label: string, startedAt: number, slowMs = DEFAULT_SLOW_MS): void {
	const elapsed = performance.now() - startedAt;
	if (elapsed >= slowMs) {
		console.log(`[db-timing] ${label} ${Math.round(elapsed)}ms`);
	}
}
