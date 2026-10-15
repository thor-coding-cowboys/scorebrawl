import { themeCssRules } from "./css";

const STYLE_ID = "scorebrawl-theme";

/**
 * Installs the shared tokens as CSS custom properties, once, before first
 * render. Dark mode is handled purely by the `.dark` class on `<html>`.
 */
export function applyThemeTokens(doc: Document = document): void {
	const existing = doc.getElementById(STYLE_ID);
	if (existing) {
		existing.textContent = themeCssRules();
		return;
	}

	const style = doc.createElement("style");
	style.id = STYLE_ID;
	style.textContent = themeCssRules();
	doc.head.appendChild(style);
}
