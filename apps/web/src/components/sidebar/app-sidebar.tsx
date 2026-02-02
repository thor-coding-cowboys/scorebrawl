import {
	AudioBook01Icon,
	Book03Icon,
	ConsoleIcon,
	CropIcon,
	MachineRobotIcon,
	MapsIcon,
	PieChartIcon,
	Settings02Icon,
} from "hugeicons-react";
import type * as React from "react";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavProjects } from "@/components/sidebar/nav-projects";
import { NavUser } from "@/components/sidebar/nav-user";
import { LeagueSwitcher } from "@/components/sidebar/league-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

// This is sample data.
const data = {
	user: {
		name: "shadcn",
		email: "m@example.com",
		avatar: "/avatars/shadcn.jpg",
	},
	teams: [
		{
			name: "Coding Cowboys",
			logo: "https://avatars.githubusercontent.com/u/246662916",
			plan: "Enterprise",
		},
		{
			name: "Acme Corp.",
			logo: AudioBook01Icon,
			plan: "Startup",
		},
		{
			name: "Evil Corp.",
			logo: Settings02Icon,
			plan: "Free",
		},
	],
	navMain: [
		{
			title: "Playground",
			url: "#",
			icon: ConsoleIcon,
			isActive: true,
			items: [
				{
					title: "History",
					url: "#",
				},
				{
					title: "Starred",
					url: "#",
				},
				{
					title: "Settings",
					url: "#",
				},
			],
		},
		{
			title: "Models",
			url: "#",
			icon: MachineRobotIcon,
			items: [
				{
					title: "Genesis",
					url: "#",
				},
				{
					title: "Explorer",
					url: "#",
				},
				{
					title: "Quantum",
					url: "#",
				},
			],
		},
		{
			title: "Documentation",
			url: "#",
			icon: Book03Icon,
			items: [
				{
					title: "Introduction",
					url: "#",
				},
				{
					title: "Get Started",
					url: "#",
				},
				{
					title: "Tutorials",
					url: "#",
				},
				{
					title: "Changelog",
					url: "#",
				},
			],
		},
		{
			title: "Settings",
			url: "#",
			icon: Settings02Icon,
			items: [
				{
					title: "General",
					url: "#",
				},
				{
					title: "Team",
					url: "#",
				},
				{
					title: "Billing",
					url: "#",
				},
				{
					title: "Limits",
					url: "#",
				},
			],
		},
	],
	projects: [
		{
			name: "Design Engineering",
			url: "#",
			icon: CropIcon,
		},
		{
			name: "Sales & Marketing",
			url: "#",
			icon: PieChartIcon,
		},
		{
			name: "Travel",
			url: "#",
			icon: MapsIcon,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data: session } = authClient.useSession();
	const { data: organizations } = authClient.useListOrganizations();
	const user = session?.user;

	const userData = user
		? {
				name: user.name || "User",
				email: user.email || "",
				avatar: user.image || "",
			}
		: {
				name: "Guest",
				email: "",
				avatar: "",
			};

	const activeOrg = session?.session?.activeOrganizationId
		? organizations?.find((org) => org.id === session.session.activeOrganizationId)
		: organizations?.[0];

	const teams =
		organizations?.map((org) => ({
			name: org.name,
			logo: org.logo || "https://avatars.githubusercontent.com/u/246662916",
			plan: org.slug,
		})) || [];

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<LeagueSwitcher teams={teams} activeTeam={activeOrg} />
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
				<NavProjects projects={data.projects} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={userData} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
