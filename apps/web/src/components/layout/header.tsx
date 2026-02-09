import type { ReactNode } from "react";
import { Logout02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

interface HeaderProps {
	includeLogoutButton?: boolean;
	children?: ReactNode;
	rightContent?: ReactNode;
}

export function Header({ children, includeLogoutButton = false, rightContent }: HeaderProps) {
	const handleLogout = async () => {
		await authClient.signOut();
		window.location.href = "/";
	};

	return (
		<header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 mb-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
			<div className="flex items-center gap-2">{children}</div>
			<div className="flex items-center gap-2">
				{rightContent}
				{includeLogoutButton && (
					<Button
						size="icon"
						variant="ghost"
						onClick={handleLogout}
						className="h-8 w-8"
						title="Sign out"
					>
						<HugeiconsIcon icon={Logout02Icon} className="size-4" />
					</Button>
				)}
			</div>
		</header>
	);
}
