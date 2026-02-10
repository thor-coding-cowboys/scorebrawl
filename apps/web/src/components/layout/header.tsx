import { Fragment, type ReactNode } from "react";
import { Logout02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
	Breadcrumb,
	BreadcrumbItem as BreadcrumbItemUI,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useSignOut } from "@/hooks/useSignOut";

export interface BreadcrumbItem {
	name: string;
	href?: string;
}

interface HeaderProps {
	includeLogoutButton?: boolean;
	children?: ReactNode;
	rightContent?: ReactNode;
	breadcrumbs?: BreadcrumbItem[];
	includeSidebarTrigger?: boolean;
}

export function Header({
	children,
	includeLogoutButton = false,
	rightContent,
	breadcrumbs,
	includeSidebarTrigger = true,
}: HeaderProps) {
	const signOut = useSignOut();

	return (
		<header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 mb-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
			<div className="flex items-center gap-2">
				{includeSidebarTrigger && (
					<>
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
					</>
				)}
				{breadcrumbs ? (
					<Breadcrumb>
						<BreadcrumbList className="flex-nowrap">
							{breadcrumbs.map((crumb, index) => {
								const key = `${crumb.name}-${crumb.href ?? ""}-${index}`;
								return (
									<Fragment key={key}>
										<BreadcrumbItemUI
											className={index < breadcrumbs.length - 1 ? "hidden md:block" : undefined}
										>
											{crumb.href ? (
												<BreadcrumbLink render={<Link to={crumb.href} />}>
													{crumb.name}
												</BreadcrumbLink>
											) : (
												<BreadcrumbPage className="truncate">{crumb.name}</BreadcrumbPage>
											)}
										</BreadcrumbItemUI>
										{index < breadcrumbs.length - 1 && (
											<BreadcrumbSeparator className="hidden md:block" />
										)}
									</Fragment>
								);
							})}
						</BreadcrumbList>
					</Breadcrumb>
				) : (
					children
				)}
			</div>
			<div className="flex items-center gap-2">
				{rightContent}
				{includeLogoutButton && (
					<Button
						size="icon"
						variant="ghost"
						onClick={signOut}
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
