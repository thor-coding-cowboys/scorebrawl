import toSlug from "@sindresorhus/slugify";

export const slugify = (
	text: string,
	{
		separator = "-",
		customReplacement = [],
		lowercase = true,
		preserveTrailingDash = false,
	}: {
		separator?: string;
		customReplacement?: [string, string][];
		lowercase?: boolean;
		preserveTrailingDash?: boolean;
	} = {}
) =>
	toSlug(text, {
		preserveTrailingDash,
		separator,
		lowercase,
		customReplacements: [["þ", "th"], ["Þ", "th"], ["ð", "d"], ["Ð", "d"], ...customReplacement],
	});
