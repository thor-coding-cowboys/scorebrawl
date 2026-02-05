import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Add01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { RowCard } from "@/components/ui/row-card";
import { CreateLeagueDialog } from "@/components/leagues/create-league-dialog";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";

export const Route = createFileRoute("/_authenticated/leagues/")({
	component: LeaguesListPage,
});

function LeaguesListPage() {
	const { data: organizations, isPending } = authClient.useListOrganizations();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	return (
		<div className="flex min-h-screen flex-col">
			<Header
				includeLogoutButton
				rightContent={
					<GlowButton
						icon={Add01Icon}
						glowColor={glowColors.blue}
						size="sm"
						className="gap-1.5"
						onClick={() => setIsCreateDialogOpen(true)}
					>
						League
					</GlowButton>
				}
			/>
			<main className="flex-1 p-4">
				<div className="mx-auto max-w-4xl">
					{isPending ? (
						<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
							Loading leagues...
						</div>
					) : !organizations || organizations.length === 0 ? (
						<div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
								<span className="text-lg">🏆</span>
							</div>
							<p>No leagues found</p>
							<GlowButton
								icon={Add01Icon}
								glowColor={glowColors.blue}
								variant="outline"
								className="gap-1.5"
								onClick={() => setIsCreateDialogOpen(true)}
							>
								Create First League
							</GlowButton>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{organizations.map((org) => (
								<div key={org.id} className="border">
									<Link to="/leagues/$slug" params={{ slug: org.slug }} className="block">
										<RowCard
											icon={
												<AvatarWithFallback
													src={org.logo}
													name={org.name}
													alt={org.name}
													size="lg"
												/>
											}
											title={org.name}
											subtitle={<span>/{org.slug}</span>}
										>
											<Button
												variant="ghost"
												size="sm"
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													// TODO: Open edit dialog
												}}
											>
												<span className="hidden sm:inline">Edit League</span>
												<span className="sm:hidden">
													<HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
												</span>
											</Button>
										</RowCard>
									</Link>
								</div>
							))}
						</div>
					)}
				</div>
			</main>
			<CreateLeagueDialog
				isOpen={isCreateDialogOpen}
				onClose={() => setIsCreateDialogOpen(false)}
			/>
		</div>
	);
}
