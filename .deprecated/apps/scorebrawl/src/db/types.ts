import type { InferSelectModel } from "drizzle-orm";
import type { LeagueInvites, Seasons, leagueMemberRoles } from "./schema";

export type LeagueMemberRole = (typeof leagueMemberRoles)[number];
export type Season = InferSelectModel<typeof Seasons>;
export type Invite = InferSelectModel<typeof LeagueInvites>;
