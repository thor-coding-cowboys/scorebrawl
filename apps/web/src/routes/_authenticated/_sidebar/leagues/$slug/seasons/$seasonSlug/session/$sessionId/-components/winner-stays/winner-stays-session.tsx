import type { GameSession } from "../session-types";

export function WinnerStaysSession({ session }: { session: GameSession }) {
	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<p className="text-muted-foreground">
				Winner Stays mode not yet implemented. Session: {session.id}
			</p>
		</div>
	);
}
