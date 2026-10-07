import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import superjson from "superjson";

import { kvStorage } from "./kv-storage";

export const PERSIST_KEY = "scorebrawl:rq-cache";

export const persister = createAsyncStoragePersister({
	key: PERSIST_KEY,
	storage: kvStorage,
	serialize: superjson.stringify,
	deserialize: superjson.parse,
	throttleTime: 1000,
});

export const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
	persister,
	maxAge: 24 * 60 * 60 * 1000,
	buster: `${Constants.expoConfig?.version ?? "0"}:v1`,
};
