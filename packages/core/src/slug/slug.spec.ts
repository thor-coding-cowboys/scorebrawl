import { describe, expect, it } from "vitest";
import { slugify, slugifyWithCustomReplacement } from "./index";

describe("slugify", () => {
	it("lowercases and separates words with dashes", () => {
		expect(slugify("Season 1")).toBe("season-1");
		expect(slugify("Hello, World!")).toBe("hello-world");
	});

	it("trims surrounding whitespace and collapses repeats", () => {
		expect(slugify("  spaced  ")).toBe("spaced");
		expect(slugify("a_b.c")).toBe("a-b-c");
	});

	it("returns an empty string for empty input", () => {
		expect(slugify("")).toBe("");
	});

	// The shared Icelandic replacement list is what makes the slug
	// Unicode-aware; mobile previously stripped these characters.
	it("transliterates Icelandic thorn and eth", () => {
		expect(slugify("Þór")).toBe("thor");
		expect(slugify("þór")).toBe("thor");
		expect(slugify("Hafnarfjörður")).toBe("hafnarfjoerdur");
		expect(slugify("Ð")).toBe("d");
	});

	// Cases the worker used to slugify server-side (season names).
	it("produces the worker's historical output for stored values", () => {
		expect(slugifyWithCustomReplacement("Þór 2024")).toBe("thor-2024");
		expect(slugifyWithCustomReplacement("Reykjavík")).toBe("reykjavik");
		expect(slugifyWithCustomReplacement("Season 1")).toBe("season-1");
		expect(slugifyWithCustomReplacement("")).toBe("");
	});

	it("keeps the worker helper identical to the default slugify", () => {
		for (const input of ["Þór", "Þór 2024", "Reykjavík", "Season 1", "  spaced  ", ""]) {
			expect(slugifyWithCustomReplacement(input)).toBe(slugify(input));
		}
	});

	describe("options", () => {
		it("honours a custom separator", () => {
			expect(slugify("Hello World", { separator: "_" })).toBe("hello_world");
		});

		it("honours lowercase: false", () => {
			expect(slugify("Hello World", { lowercase: false })).toBe("Hello-World");
		});

		it("maps custom replacements and overrides the defaults", () => {
			expect(slugify("Hello World", { customReplacement: [["Hello", "Hi"]] })).toBe("hi-world");
			expect(
				slugify("Þór", {
					customReplacement: [
						["þ", "x"],
						["Þ", "x"],
					],
				})
			).toBe("xor");
		});

		it("honours preserveTrailingDash", () => {
			expect(slugify("Hello-", { preserveTrailingDash: true })).toBe("hello-");
			expect(slugify("Hello-", { preserveTrailingDash: false })).toBe("hello");
		});
	});

	// Inputs mobile used to slugify with its naive regex. Non-ASCII is the
	// deliberate behaviour change: "Þór" used to become "r", now "thor".
	describe("mobile's previous input set", () => {
		it("still slugifies ASCII names", () => {
			expect(slugify("My League")).toBe("my-league");
			expect(slugify("test_league")).toBe("test-league");
			expect(slugify("UPPER")).toBe("upper");
			expect(slugify("  trim  ")).toBe("trim");
			expect(slugify("")).toBe("");
		});

		it("no longer strips non-ASCII characters", () => {
			expect(slugify("Þór")).toBe("thor");
			expect(slugify("Þór 2024")).toBe("thor-2024");
		});
	});
});
