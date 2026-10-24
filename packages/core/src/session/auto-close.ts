export const SESSION_AUTO_CLOSE_TTL_MS = 60 * 60 * 1000;

export const SESSION_AUTO_CLOSE_WARNING_MS = 10 * 60 * 1000;

export function getSessionAutoCloseRemainingMs(
	autoEndsAt: Date | number | null | undefined,
	now: number = Date.now()
): number | null {
	if (autoEndsAt === null || autoEndsAt === undefined) return null;
	const deadline = autoEndsAt instanceof Date ? autoEndsAt.getTime() : autoEndsAt;
	return deadline - now;
}

export function isSessionAutoCloseExpired(
	autoEndsAt: Date | number | null | undefined,
	now: number = Date.now()
): boolean {
	const remaining = getSessionAutoCloseRemainingMs(autoEndsAt, now);
	return remaining !== null && remaining <= 0;
}

export function getSessionAutoCloseDeadline(from: number = Date.now()): Date {
	return new Date(from + SESSION_AUTO_CLOSE_TTL_MS);
}
