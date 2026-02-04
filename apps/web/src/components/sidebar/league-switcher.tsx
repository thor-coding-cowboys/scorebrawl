import { Add01Icon, ArrowUpDoubleIcon, ListViewIcon } from "hugeicons-react";
import type * as React from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function LeagueSwitcher({
	teams,
	activeTeam,
}: {
	teams: {
		name: string;
		logo: React.ElementType | string | null;
		plan: string;
	}[];
	activeTeam?: {
		id: string;
		name: string;
		slug: string;
		logo?: string | null;
	};
}) {
	const { isMobile } = useSidebar();
	const navigate = useNavigate();
	const location = useLocation();

	const currentActiveTeam = activeTeam
		? {
				name: activeTeam.name,
				logo: activeTeam.logo || "https://avatars.githubusercontent.com/u/246662916",
				plan: activeTeam.slug,
			}
		: teams[0];

	if (!currentActiveTeam) {
		return null;
	}

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	const renderLogo = (
		logo: React.ElementType | string | null,
		name: string,
		className: string,
		size: "sm" | "default" = "default"
	) => {
		if (typeof logo === "string") {
			return (
				<Avatar className={cn("rounded-lg", size === "sm" ? "h-6 w-6" : "h-8 w-8")}>
					<AvatarImage src={logo || undefined} alt={name} className="rounded-lg" />
					<AvatarFallback className="rounded-lg text-xs">{getInitials(name)}</AvatarFallback>
				</Avatar>
			);
		}
		if (logo === null) {
			return (
				<Avatar className={cn("rounded-lg", size === "sm" ? "h-6 w-6" : "h-8 w-8")}>
					<AvatarFallback className="rounded-lg text-xs">{getInitials(name)}</AvatarFallback>
				</Avatar>
			);
		}
		const LogoComponent = logo;
		return <LogoComponent className={className} />;
	};

	const handleTeamSelect = async (team: {
		name: string;
		logo: React.ElementType | string | null;
		plan: string;
	}) => {
		await authClient.organization.setActive({
			organizationSlug: team.plan,
		});
		const currentPath = location.pathname;
		if (currentPath.startsWith("/leagues/")) {
			navigate({ to: "/leagues/$slug", params: { slug: team.plan }, replace: true });
		}
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<SidebarMenuButton size="lg" asChild>
						<DropdownMenuTrigger className="w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
							{renderLogo(currentActiveTeam.logo, currentActiveTeam.name, "size-4", "default")}
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{currentActiveTeam.name}</span>
								<span className="truncate text-xs">/{currentActiveTeam.plan}</span>
							</div>
							<ArrowUpDoubleIcon className="ml-auto" />
						</DropdownMenuTrigger>
					</SidebarMenuButton>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
						align="start"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-muted-foreground text-xs">
								Leagues
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						{teams.map((team) => (
							<DropdownMenuItem
								key={team.name}
								onClick={() => handleTeamSelect(team)}
								className="gap-2 p-2"
							>
								{renderLogo(team.logo, team.name, "size-3.5 shrink-0", "sm")}
								{team.name}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="gap-2 p-2"
							onClick={() => navigate({ to: "/leagues/create" })}
						>
							<div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
								<Add01Icon className="size-4" />
							</div>
							<div className="text-muted-foreground font-medium">Create league</div>
						</DropdownMenuItem>
						<DropdownMenuItem className="gap-2 p-2" onClick={() => navigate({ to: "/leagues" })}>
							<div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
								<ListViewIcon className="size-4" />
							</div>
							<div className="text-muted-foreground font-medium">All leagues</div>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
