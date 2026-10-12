import { router, type Href } from "expo-router";

export function resetTo(href: Href) {
	if (router.canDismiss()) router.dismissAll();
	router.replace(href);
}
