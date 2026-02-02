import { Add01Icon, ArrowUpDoubleIcon } from "hugeicons-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function TeamSwitcher({
	teams,
}: {
	teams: {
		name: string;
		logo: React.ElementType | string;
		plan: string;
	}[];
}) {
	const { isMobile } = useSidebar();
	const [activeTeam, setActiveTeam] = React.useState(teams[0]);

	if (!activeTeam) {
		return null;
	}

	const renderLogo = (
		logo: React.ElementType | string,
		className: string,
		size: "sm" | "default" = "default"
	) => {
		if (typeof logo === "string") {
			return (
				<Avatar className={cn("rounded-lg", size === "sm" ? "h-6 w-6" : "h-8 w-8")}>
					<AvatarImage src={logo} alt="" className="rounded-lg" />
					<AvatarFallback className="rounded-lg" />
				</Avatar>
			);
		}
		const LogoComponent = logo;
		return <LogoComponent className={className} />;
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<SidebarMenuButton size="lg" asChild>
						<DropdownMenuTrigger className="w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
							{renderLogo(activeTeam.logo, "size-4", "default")}
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{activeTeam.name}</span>
								<span className="truncate text-xs">{activeTeam.plan}</span>
							</div>
							<ArrowUpDoubleIcon className="ml-auto" />
						</DropdownMenuTrigger>
					</SidebarMenuButton>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						align="start"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-muted-foreground text-xs">Teams</DropdownMenuLabel>
						</DropdownMenuGroup>
						{teams.map((team, index) => (
							<DropdownMenuItem
								key={team.name}
								onClick={() => setActiveTeam(team)}
								className="gap-2 p-2"
							>
								{renderLogo(team.logo, "size-3.5 shrink-0", "sm")}
								{team.name}
								<DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem className="gap-2 p-2">
							<div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
								<Add01Icon className="size-4" />
							</div>
							<div className="text-muted-foreground font-medium">Add team</div>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
