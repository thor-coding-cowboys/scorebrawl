import {
	Activity01Icon,
	Award01Icon,
	UserMultipleIcon,
	Mail01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import type * as React from "react";
import { useMemo } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";

import { NavUser } from "@/components/sidebar/nav-user";
import { LeagueSwitcher } from "@/components/sidebar/league-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarGroup,
	SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { trpcClient } from "@/lib/trpc";

// Helper to construct asset URL from key
const getAssetUrl = (key: string | null | undefined): string | null => {
	if (!key) return null;
	// If it's already a full URL, return it
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return key;
	}
	// Construct API URL from key
	return `/api/user-assets/${key}`;
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data: session } = authClient.useSession();
	const { data: organizations } = authClient.useListOrganizations();
	const matchRoute = useMatchRoute();
	const user = session?.user;

	const userData = user
		? {
				name: user.name || "User",
				email: user.email || "",
				avatar: getAssetUrl(user.image),
			}
		: {
				name: "Guest",
				email: "",
				avatar: null,
			};

	const activeOrg = session?.session?.activeOrganizationId
		? organizations?.find((org) => org.id === session.session.activeOrganizationId)
		: organizations?.[0];

	// Add logo URL to active org using the API endpoint
	const activeOrgWithLogo = activeOrg
		? {
				id: activeOrg.id,
				name: activeOrg.name,
				slug: activeOrg.slug,
				logo: getAssetUrl(activeOrg.logo),
			}
		: undefined;

	// For the team switcher, we can only show the active org's logo
	// since we need the active org context to fetch the logo
	const teams =
		organizations?.map((org) => ({
			name: org.name,
			logo: getAssetUrl(org.logo),
			plan: org.slug,
		})) || [];

	// Get active league slug for navigation
	const leagueSlug = activeOrg?.slug;

	// Check which routes are active
	const routeMatches = useMemo(() => {
		const isActiveSeasonRoute = matchRoute({
			to: "/leagues/$slug/seasons/$seasonSlug",
			fuzzy: true,
		});
		const isSeasonsListRoute =
			matchRoute({ to: "/leagues/$slug/seasons", fuzzy: true }) && !isActiveSeasonRoute;
		const isMembersRoute = matchRoute({ to: "/leagues/$slug/members", fuzzy: true });
		const isInvitationsRoute = matchRoute({ to: "/leagues/$slug/invitations", fuzzy: true });
		return { isActiveSeasonRoute, isSeasonsListRoute, isMembersRoute, isInvitationsRoute };
	}, [matchRoute]);

	// Fetch active season for the current league
	const { data: activeSeason } = useQuery({
		queryKey: ["active-season", leagueSlug],
		queryFn: async () => {
			return await trpcClient.season.findActive.query();
		},
		enabled: !!leagueSlug,
	});

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<LeagueSwitcher teams={teams} activeTeam={activeOrgWithLogo} />
			</SidebarHeader>
			<SidebarContent>
				{leagueSlug && (
					<SidebarGroup>
						<SidebarGroupLabel>League</SidebarGroupLabel>
						<SidebarMenu>
							{activeSeason && (
								<SidebarMenuItem>
									<SidebarMenuButton asChild isActive={!!routeMatches.isActiveSeasonRoute}>
										<Link
											to="/leagues/$slug/seasons/$seasonSlug"
											params={{ slug: leagueSlug, seasonSlug: activeSeason.slug }}
										>
											<HugeiconsIcon icon={Activity01Icon} className="size-4" />
											<span>Active Season</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							)}
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={!!routeMatches.isSeasonsListRoute}>
									<Link to="/leagues/$slug/seasons" params={{ slug: leagueSlug }}>
										<HugeiconsIcon icon={Award01Icon} className="size-4" />
										<span>Seasons</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={!!routeMatches.isMembersRoute}>
									<Link to="/leagues/$slug/members" params={{ slug: leagueSlug }}>
										<HugeiconsIcon icon={UserMultipleIcon} className="size-4" />
										<span>Members</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={!!routeMatches.isInvitationsRoute}>
									<Link to="/leagues/$slug/invitations" params={{ slug: leagueSlug }}>
										<HugeiconsIcon icon={Mail01Icon} className="size-4" />
										<span>Invitations</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroup>
				)}
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={userData} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
