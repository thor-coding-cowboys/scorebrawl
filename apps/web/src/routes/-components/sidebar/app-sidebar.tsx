import {
	Activity01Icon,
	Award01Icon,
	UserMultipleIcon,
	UserIcon,
	Mail01Icon,
	ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import type * as React from "react";

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
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarGroup,
	SidebarGroupLabel,
	useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
	const { data: activeMember } = authClient.useActiveMember();
	const matchRoute = useMatchRoute();
	const { isMobile, setOpenMobile } = useSidebar();
	const user = session?.user;

	const userRole = activeMember?.role;
	const canManageMembers = userRole === "owner" || userRole === "editor";

	// Helper to close sidebar on mobile when navigating
	const handleNavClick = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

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

	// Check which routes are active - call matchRoute directly without memo
	// to ensure it re-evaluates on every render when route changes
	const isActiveSeasonRoute = matchRoute({
		to: "/leagues/$slug/seasons/$seasonSlug",
		fuzzy: false,
	});
	const isSeasonsListRoute = matchRoute({
		to: "/leagues/$slug/seasons",
		fuzzy: false,
	});
	const isTeamsRoute = matchRoute({ to: "/leagues/$slug/teams", fuzzy: false });
	const isPlayersRoute = matchRoute({ to: "/leagues/$slug/players", fuzzy: false });
	const isMembersRoute = matchRoute({ to: "/leagues/$slug/members", fuzzy: false });
	const isInvitationsRoute = matchRoute({ to: "/leagues/$slug/invitations", fuzzy: false });

	// Fetch all active seasons for the current league
	const { data: activeSeasons } = useQuery({
		queryKey: ["active-seasons", leagueSlug],
		queryFn: async () => {
			return await trpcClient.season.findAllActive.query();
		},
		enabled: !!leagueSlug,
	});

	const activeSeasonCount = activeSeasons?.length ?? 0;
	const hasMultipleActiveSeasons = activeSeasonCount > 1;
	const singleActiveSeason = activeSeasonCount === 1 && activeSeasons ? activeSeasons[0] : null;

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
							{activeSeasonCount > 0 &&
								(hasMultipleActiveSeasons ? (
									<Collapsible defaultOpen={!!isActiveSeasonRoute} className="group/collapsible">
										<SidebarMenuItem>
											<SidebarMenuButton asChild isActive={!!isActiveSeasonRoute}>
												<CollapsibleTrigger>
													<HugeiconsIcon icon={Activity01Icon} className="size-4" />
													<span>Active Seasons</span>
													<HugeiconsIcon
														icon={ArrowRight01Icon}
														className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
													/>
												</CollapsibleTrigger>
											</SidebarMenuButton>
											<CollapsibleContent>
												<SidebarMenuSub>
													{activeSeasons?.map((season) => (
														<SidebarMenuSubItem key={season.id}>
															<SidebarMenuSubButton asChild>
																<Link
																	to="/leagues/$slug/seasons/$seasonSlug"
																	params={{ slug: leagueSlug, seasonSlug: season.slug }}
																	onClick={handleNavClick}
																>
																	<span>{season.name}</span>
																</Link>
															</SidebarMenuSubButton>
														</SidebarMenuSubItem>
													))}
												</SidebarMenuSub>
											</CollapsibleContent>
										</SidebarMenuItem>
									</Collapsible>
								) : (
									<SidebarMenuItem>
										<SidebarMenuButton asChild isActive={!!isActiveSeasonRoute}>
											<Link
												to="/leagues/$slug/seasons/$seasonSlug"
												params={{
													slug: leagueSlug,
													seasonSlug: singleActiveSeason?.slug ?? "",
												}}
												onClick={handleNavClick}
											>
												<HugeiconsIcon icon={Activity01Icon} className="size-4" />
												<span>Active Season</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={!!isSeasonsListRoute}>
									<Link
										to="/leagues/$slug/seasons"
										params={{ slug: leagueSlug }}
										onClick={handleNavClick}
									>
										<HugeiconsIcon icon={Award01Icon} className="size-4" />
										<span>Seasons</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={!!isTeamsRoute}>
									<Link
										to="/leagues/$slug/teams"
										params={{ slug: leagueSlug }}
										onClick={handleNavClick}
									>
										<HugeiconsIcon icon={UserMultipleIcon} className="size-4" />
										<span>Teams</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={!!isPlayersRoute}>
									<Link
										to="/leagues/$slug/players"
										params={{ slug: leagueSlug }}
										onClick={handleNavClick}
									>
										<HugeiconsIcon icon={UserIcon} className="size-4" />
										<span>Players</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							{canManageMembers && (
								<>
									<SidebarMenuItem>
										<SidebarMenuButton asChild isActive={!!isMembersRoute}>
											<Link
												to="/leagues/$slug/members"
												params={{ slug: leagueSlug }}
												onClick={handleNavClick}
											>
												<HugeiconsIcon icon={UserMultipleIcon} className="size-4" />
												<span>Members</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton asChild isActive={!!isInvitationsRoute}>
											<Link
												to="/leagues/$slug/invitations"
												params={{ slug: leagueSlug }}
												onClick={handleNavClick}
											>
												<HugeiconsIcon icon={Mail01Icon} className="size-4" />
												<span>Invitations</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</>
							)}
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
