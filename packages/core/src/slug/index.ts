import toSlug from "@sindresorhus/slugify";

const ICELANDIC_REPLACEMENTS: [string, string][] = [
	["þ", "th"],
	["Þ", "th"],
	["ð", "d"],
	["Ð", "d"],
];

export interface SlugifyOptions {
	separator?: string;
	customReplacement?: [string, string][];
	lowercase?: boolean;
	preserveTrailingDash?: boolean;
}

export const slugify = (
	text: string,
	{
		separator = "-",
		customReplacement = [],
		lowercase = true,
		preserveTrailingDash = false,
	}: SlugifyOptions = {}
) =>
	toSlug(text, {
		preserveTrailingDash,
		separator,
		lowercase,
		customReplacements: [...ICELANDIC_REPLACEMENTS, ...customReplacement],
	});

export const slugifyWithCustomReplacement = (text: string) => slugify(text);
