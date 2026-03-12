import { UserIcon, Award01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";

import { Link, useMatchRoute } from "@tanstack/react-router";

import { NavUser } from "@/components/sidebar/nav-user";
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
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

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

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data: session } = authClient.useSession();
	const matchRoute = useMatchRoute();
	const { isMobile, setOpenMobile } = useSidebar();
	const user = session?.user;

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

	// Check which routes are active - use path from generated routes
	const isUsersRoute = matchRoute({ to: "/admin/users", fuzzy: false });
	const isLeaguesRoute = matchRoute({ to: "/admin/leagues", fuzzy: false });

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<div className="flex h-12 items-center px-4">
					<Link to="/admin" className="flex items-center gap-2 font-semibold text-lg">
						<span className="truncate">Admin</span>
					</Link>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Management</SidebarGroupLabel>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild isActive={!!isUsersRoute}>
								<Link to="/admin/users" onClick={handleNavClick}>
									<HugeiconsIcon icon={UserIcon} className="size-4" />
									<span>Users</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton asChild isActive={!!isLeaguesRoute}>
								<Link to="/admin/leagues" onClick={handleNavClick}>
									<HugeiconsIcon icon={Award01Icon} className="size-4" />
									<span>Leagues</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={userData} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
