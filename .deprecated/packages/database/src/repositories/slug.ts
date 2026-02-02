import slugify from "@sindresorhus/slugify";

export const slugifyWithCustomReplacement = (text: string) => {
  return slugify(text, {
    customReplacements: [
      ["þ", "th"],
      ["Þ", "th"],
      ["ð", "d"],
      ["Ð", "d"],
    ],
  });
};
