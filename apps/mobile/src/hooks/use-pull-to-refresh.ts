import { useCallback, useState } from "react";

export function usePullToRefresh(refresh: () => Promise<unknown>) {
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = useCallback(() => {
		setRefreshing(true);
		void refresh().finally(() => setRefreshing(false));
	}, [refresh]);

	return { refreshing, onRefresh };
}
