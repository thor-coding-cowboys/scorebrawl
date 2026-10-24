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

interface SessionAutoCloseBannerProps {
	sessionId: string;
	seasonSlug: string;
	autoEndsAt: Date | null;
}

function formatRemaining(minutesLeft: number) {
	if (minutesLeft <= 0) return "less than a minute";
	if (minutesLeft === 1) return "1 minute";
	return `${minutesLeft} minutes`;
}

export function SessionAutoCloseBanner({
	sessionId,
	seasonSlug,
	autoEndsAt,
}: SessionAutoCloseBannerProps) {
	const queryClient = useQueryClient();
	const trpc = useTRPC();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
		return () => clearInterval(interval);
	}, []);

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

	const remainingMs = getSessionAutoCloseRemainingMs(autoEndsAt, now);
	if (remainingMs === null || remainingMs > SESSION_AUTO_CLOSE_WARNING_MS) return null;

	const minutesLeft = Math.max(0, Math.ceil(remainingMs / 60_000));

	return (
		<div
			className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2"
			data-testid="session-auto-close-banner"
		>
			<div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
				<HugeiconsIcon icon={Timer02Icon} className="size-4 shrink-0" />
				<span>
					Session auto closes in{" "}
					<span className="font-semibold">{formatRemaining(minutesLeft)}</span> unless you register
					a game.
				</span>
			</div>
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
		</div>
	);
}
