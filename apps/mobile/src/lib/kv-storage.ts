import Storage from "expo-sqlite/kv-store";

export const kvStorage = {
	getItem: (key: string) => Storage.getItem(key),
	setItem: (key: string, value: string) => Storage.setItem(key, value),
	removeItem: (key: string) => Storage.removeItem(key),
};
