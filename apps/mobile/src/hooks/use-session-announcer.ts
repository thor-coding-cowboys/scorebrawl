import * as Speech from "expo-speech";
import { useEffect, useRef } from "react";

import {
	buildAnnouncement,
	getNextLineup,
	lineupSignature,
} from "@coding-cowboys/scorebrawl-core/session";
import type { GameSession } from "@/components/session/types";

export function useSessionAnnouncer({
	session,
	enabled,
}: {
	session: GameSession | undefined;
	enabled: boolean;
}) {
	const baselineRef = useRef<string | null>(null);
	const initializedRef = useRef(false);

	useEffect(() => {
		if (!enabled) void Speech.stop();
		return () => {
			void Speech.stop();
		};
	}, [enabled]);

	useEffect(() => {
		if (!session) return;

		const lineup = getNextLineup(session);
		const signature = lineup ? lineupSignature(lineup) : null;

		if (!enabled || !initializedRef.current) {
			initializedRef.current = true;
			baselineRef.current = signature;
			return;
		}

		const changed = signature !== null && signature !== baselineRef.current;
		baselineRef.current = signature;

		if (changed && lineup) {
			void Speech.stop();
			Speech.speak(buildAnnouncement(session, lineup));
		}
	}, [session, enabled]);
}
