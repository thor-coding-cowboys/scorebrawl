import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Timer02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import {
	getSessionAutoCloseRemainingMs,
	SESSION_AUTO_CLOSE_WARNING_MS,
} from "@coding-cowboys/scorebrawl-core/session";
import { Button } from "@/components/ui/button";
import { trpcClient, useTRPC } from "@/lib/trpc";

const COUNTDOWN_TICK_MS = 15_000;
const SECOND_TICK_MS = 1_000;
const SECOND_COUNTDOWN_THRESHOLD_MS = 60_000;
const EXPIRY_REFRESH_MS = 5_000;

interface SessionAutoCloseBannerProps {
	sessionId: string;
	seasonSlug: string;
	autoEndsAt: Date | null;
}

function formatRemaining(remainingMs: number) {
	if (remainingMs >= SECOND_COUNTDOWN_THRESHOLD_MS) {
		const minutesLeft = Math.ceil(remainingMs / 60_000);
		return minutesLeft === 1 ? "1 minute" : `${minutesLeft} minutes`;
	}

	const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1_000));
	return secondsLeft === 1 ? "1 second" : `${secondsLeft} seconds`;
}

export function SessionAutoCloseBanner({
	sessionId,
	seasonSlug,
	autoEndsAt,
}: SessionAutoCloseBannerProps) {
	const queryClient = useQueryClient();
	const trpc = useTRPC();
	const [now, setNow] = useState(() => Date.now());

	const remainingMs = getSessionAutoCloseRemainingMs(autoEndsAt, now);
	const isInFinalMinute = remainingMs !== null && remainingMs <= SECOND_COUNTDOWN_THRESHOLD_MS;
	const isExpired = remainingMs !== null && remainingMs <= 0;

	useEffect(() => {
		const interval = setInterval(
			() => setNow(Date.now()),
			isInFinalMinute ? SECOND_TICK_MS : COUNTDOWN_TICK_MS
		);
		return () => clearInterval(interval);
	}, [isInFinalMinute]);

	useEffect(() => {
		if (!isExpired) return;

		const refresh = () => {
			void queryClient.invalidateQueries(trpc.session.getById.queryFilter({ sessionId }));
			void queryClient.invalidateQueries(trpc.session.getActive.queryFilter({ seasonSlug }));
		};

		refresh();
		const interval = setInterval(refresh, EXPIRY_REFRESH_MS);
		return () => clearInterval(interval);
	}, [isExpired, queryClient, sessionId, seasonSlug, trpc]);

	const extendSession = useMutation({
		mutationFn: () => trpcClient.session.extend.mutate({ sessionId }),
		onSuccess: () => {
			void queryClient.invalidateQueries(trpc.session.getById.queryFilter({ sessionId }));
			void queryClient.invalidateQueries(trpc.session.getActive.queryFilter({ seasonSlug }));
			void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			toast.success("Session extended by 1 hour");
		},
		onError: () => toast.error("Failed to extend session"),
	});

	if (remainingMs === null || remainingMs > SESSION_AUTO_CLOSE_WARNING_MS) return null;

	return (
		<div
			className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2"
			data-testid="session-auto-close-banner"
		>
			<div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
				<HugeiconsIcon icon={Timer02Icon} className="size-4 shrink-0" />
				{isExpired ? (
					<span data-testid="session-auto-close-countdown">Closing session…</span>
				) : (
					<span>
						Session auto closes in{" "}
						<span className="font-semibold" data-testid="session-auto-close-countdown">
							{formatRemaining(remainingMs)}
						</span>{" "}
						unless you register a game.
					</span>
				)}
			</div>
			{!isExpired && (
				<Button
					size="sm"
					variant="outline"
					className="gap-1.5 border-amber-500/30 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
					onClick={() => extendSession.mutate()}
					disabled={extendSession.isPending}
					data-testid="session-extend"
				>
					{extendSession.isPending ? "Extending…" : "Extend by 1 hour"}
				</Button>
			)}
		</div>
	);
}
