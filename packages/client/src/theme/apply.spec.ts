import { describe, expect, it } from "vitest";

import { applyThemeTokens } from "./apply";

type FakeStyle = { id: string; textContent: string };

function fakeDoc() {
	const nodes: FakeStyle[] = [];
	return {
		nodes,
		getElementById: (id: string) => nodes.find((node) => node.id === id) ?? null,
		createElement: (): FakeStyle => ({ id: "", textContent: "" }),
		head: { appendChild: (node: FakeStyle) => void nodes.push(node) },
	};
}

describe("applyThemeTokens", () => {
	it("installs both rules in a single style element", () => {
		const doc = fakeDoc();
		applyThemeTokens(doc as unknown as Document);
		expect(doc.nodes).toHaveLength(1);
		expect(doc.nodes[0]?.id).toBe("scorebrawl-theme");
		expect(doc.nodes[0]?.textContent).toContain("--background:");
		expect(doc.nodes[0]?.textContent).toContain(":root.dark{");
	});

	it("is idempotent", () => {
		const doc = fakeDoc();
		applyThemeTokens(doc as unknown as Document);
		applyThemeTokens(doc as unknown as Document);
		expect(doc.nodes).toHaveLength(1);
	});
});
