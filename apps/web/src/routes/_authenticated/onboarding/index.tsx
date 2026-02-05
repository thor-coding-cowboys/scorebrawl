import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { ThemeSwitcher } from "@/components/theme-switcher";

export const Route = createFileRoute("/_authenticated/onboarding/")({
	component: OnboardingIndex,
});

function OnboardingIndex() {
	return (
		<div className="flex min-h-screen flex-col">
			<Header includeLogoutButton rightContent={<ThemeSwitcher />} />
			<div className="flex flex-1 items-center justify-center p-4">
				<div className="w-full max-w-4xl">
					<div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
						<Card className="w-full lg:w-7/12 border-0 shadow-none">
							<CardHeader className="text-center">
								{/* Mobile logo */}
								<div className="lg:hidden mb-4 flex justify-center">
									<img src="/scorebrawl-monochrome.png" alt="Scorebrawl" className="w-24 h-24" />
								</div>
								<CardTitle className="text-3xl font-bold">Welcome to Scorebrawl!</CardTitle>
								<CardDescription className="text-lg">
									Let's get you started by creating your first league.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col items-center gap-6">
								<p className="text-center text-muted-foreground">
									A league is where you track scores, manage players, and compete with friends.
									Whether it's board games, sports, or any season, Scorebrawl helps you keep track
									of everything.
								</p>

								<div className="w-full space-y-4">
									<div className="rounded-lg border p-4">
										<h3 className="font-semibold mb-2">What you can do with leagues:</h3>
										<ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
											<li>Track matches and scores in real-time</li>
											<li>Manage players and teams</li>
											<li>View standings and statistics</li>
											<li>Create multiple seasons</li>
											<li>Unlock achievements</li>
										</ul>
									</div>
								</div>

								<Link to="/onboarding/create-league">
									<Button size="lg">Create your first league</Button>
								</Link>
							</CardContent>
						</Card>

						{/* Logo on right side for desktop */}
						<div className="hidden lg:block flex-shrink-0 lg:w-5/12">
							<img
								src="/scorebrawl-monochrome.png"
								alt="Scorebrawl"
								className="w-full h-auto object-cover rounded-xl"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
