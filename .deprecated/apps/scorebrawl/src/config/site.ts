const siteUrl = "https://scorebrawl.com";

export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  openGraphImage: string;
  links: {
    twitter: string;
    github: string;
  };
};

export const siteConfig: SiteConfig = {
  name: "Scorebrawl",
  description:
    "Scorebrawl, the ultimate web platform designed for tracking and elevating your competitive spirit! " +
    "Whether you're battling it out in video games or engaging in friendly office games like pool and darts, " +
    "ScoreBrawl is your go-to hub for registering and settling scores among friends, colleagues, or in real competitions. " +
    "Fuel the fun, ignite the competition, and let ScoreBrawl be the scoreboard for your victories!",
  url: siteUrl,
  openGraphImage: `${siteUrl}/scorebrawl.jpg`,
  links: {
    twitter: "https://twitter.com/palmithor",
    github: "https://github.com/scorebrawl",
  },
};
