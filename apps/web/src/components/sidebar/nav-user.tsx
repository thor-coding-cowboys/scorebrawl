import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDoubleIcon, CheckmarkBadge01Icon, Logout01Icon } from "hugeicons-react";
import { ComputerIcon, Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "next-themes";
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

export function NavUser({
	user,
}: {
	user: {
		name: string;
		email: string;
		avatar: string | null;
	};
}) {
	const { isMobile } = useSidebar();
	const navigate = useNavigate();
	const { theme, setTheme } = useTheme();

	const cycleTheme = () => {
		if (theme === "light") {
			setTheme("dark");
		} else if (theme === "dark") {
			setTheme("system");
		} else {
			setTheme("light");
		}
	};

	const getThemeIcon = () => {
		if (theme === "light") return Sun01Icon;
		if (theme === "dark") return Moon02Icon;
		return ComputerIcon;
	};

	const getThemeLabel = () => {
		if (theme === "light") return "Light";
		if (theme === "dark") return "Dark";
		return "System";
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<SidebarMenuButton size="lg" asChild>
						<DropdownMenuTrigger className="w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
							<Avatar className="h-8 w-8 rounded-lg">
								<AvatarImage
									src={user.avatar || undefined}
									alt={user.name}
									className="rounded-lg"
								/>
								<AvatarFallback className="rounded-lg">
									{user.name
										.split(" ")
										.map((n) => n[0])
										.join("")
										.toUpperCase()
										.slice(0, 2)}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-xs leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs text-muted-foreground">{user.email}</span>
							</div>
							<ArrowUpDoubleIcon className="ml-auto size-4" />
						</DropdownMenuTrigger>
					</SidebarMenuButton>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-none"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-xs">
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarImage
											src={user.avatar || undefined}
											alt={user.name}
											className="rounded-lg"
										/>
										<AvatarFallback className="rounded-lg">
											{user.name
												.split(" ")
												.map((n) => n[0])
												.join("")
												.toUpperCase()
												.slice(0, 2)}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-xs leading-tight">
										<span className="truncate font-medium">{user.name}</span>
										<span className="truncate text-xs text-muted-foreground">{user.email}</span>
									</div>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
								<CheckmarkBadge01Icon />
								Profile
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<div
							className="focus:bg-accent focus:text-accent-foreground gap-2 rounded-none px-2 py-2 text-xs relative flex cursor-pointer items-center select-none outline-hidden"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								cycleTheme();
							}}
							tabIndex={-1}
						>
							<HugeiconsIcon icon={getThemeIcon()} className="size-4" />
							<span>{getThemeLabel()} mode</span>
						</div>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={async () => {
								await authClient.signOut({
									fetchOptions: {
										onSuccess: () => {
											window.location.href = "/";
										},
									},
								});
							}}
						>
							<Logout01Icon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
