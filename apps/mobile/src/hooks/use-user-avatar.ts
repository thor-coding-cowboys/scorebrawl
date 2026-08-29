import { useEffect, useState } from "react";

import { AUTH_BASE_URL, getAuthCookie } from "@/lib/auth-client";

export function getAvatarUri(image?: string | null) {
	return image?.startsWith("http")
		? image
		: image
			? `${AUTH_BASE_URL}/api/user-assets/${encodeURIComponent(image)}`
			: undefined;
}

export function useUserAvatar(image?: string | null) {
	const [cookie, setCookie] = useState<string | undefined>();

	useEffect(() => {
		let active = true;
		getAuthCookie().then((c) => {
			if (active) setCookie(c);
		});
		return () => {
			active = false;
		};
	}, []);

	return {
		uri: getAvatarUri(image),
		headers: cookie ? { cookie } : undefined,
	};
}
