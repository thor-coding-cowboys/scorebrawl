import { useCallback, useEffect, useState } from "react";

import { getAnnouncerEnabled, setAnnouncerEnabled } from "@/lib/announcer-pref";

export function useAnnouncer() {
	const [enabled, setEnabledState] = useState(false);

	useEffect(() => {
		let active = true;
		getAnnouncerEnabled().then((value) => {
			if (active) setEnabledState(value);
		});
		return () => {
			active = false;
		};
	}, []);

	const setEnabled = useCallback((next: boolean) => {
		setEnabledState(next);
		void setAnnouncerEnabled(next);
	}, []);

	return { enabled, setEnabled };
}
