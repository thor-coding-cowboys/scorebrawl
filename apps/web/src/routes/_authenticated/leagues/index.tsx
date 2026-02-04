import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { authClient } from "@/lib/auth-client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Add01Icon } from "hugeicons-react";

export const Route = createFileRoute("/_authenticated/leagues/")({
	component: LeaguesListPage,
});

function LeaguesListPage() {
	const { data: organizations, isPending } = authClient.useListOrganizations();

	if (isPending) {
		return (
			<div className="flex min-h-screen flex-col">
				<Header includeLogoutButton />
				<main className="flex flex-1 items-center justify-center p-4">
					<div className="text-muted-foreground">Loading leagues...</div>
				</main>
			</div>
		);
	}

	if (!organizations || organizations.length === 0) {
		return (
			<div className="flex min-h-screen flex-col">
				<Header includeLogoutButton />
				<main className="flex flex-1 items-center justify-center p-4">
					<div className="text-muted-foreground">No leagues found.</div>
				</main>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col">
			<Header includeLogoutButton />
			<main className="flex-1 p-4">
				<div className="mx-auto max-w-4xl">
					<div className="mb-6 flex items-center justify-between">
						<h1 className="text-2xl font-semibold">Your Leagues</h1>
						<Link to="/leagues/create">
							<Button>
								<Add01Icon className="h-4 w-4" />
								League
							</Button>
						</Link>
					</div>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{organizations.map((org) => (
							<Link key={org.id} to="/leagues/$slug" params={{ slug: org.slug }} className="block">
								<Card className="hover:border-primary/50 cursor-pointer transition-all">
									<CardHeader>
										<CardTitle className="truncate">{org.name}</CardTitle>
										<CardDescription className="truncate">/{org.slug}</CardDescription>
									</CardHeader>
								</Card>
							</Link>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}
