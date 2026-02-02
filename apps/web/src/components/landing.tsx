import {
	ArrowUp01Icon,
	BarChartIcon,
	GithubIcon,
	UserMultipleIcon,
	ViewIcon,
	Tick02Icon,
	Target02Icon,
	MedalFirstPlaceIcon,
	AwardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

const GetStartedButton = ({
	variant = "default",
	size = "default",
	className,
}: {
	variant?: "default" | "secondary" | "outline";
	size?: "default" | "lg";
	className?: string;
}) => {
	const navigate = useNavigate();
	return (
		<Button
			variant={variant}
			size={size}
			className={className}
			onClick={() => navigate({ to: "/auth/sign-in" })}
		>
			Get Started
		</Button>
	);
};

const Landing = () => {
	const navigate = useNavigate();
	const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
	const { data: session, isPending } = authClient.useSession();

	return (
		<div className="min-h-screen bg-background">
			{/* Navigation */}
			<nav className="border-b bg-background/50 backdrop-blur-xl sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
								<HugeiconsIcon icon={BarChartIcon} className="w-6 h-6 text-primary-foreground" />
							</div>
							<span className="text-2xl font-bold text-foreground">Scorebrawl</span>
						</div>
						<div className="flex items-center gap-4">
							<a
								href="https://github.com/thor-coding-cowboys/scorebrawl"
								target="_blank"
								rel="noreferrer"
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								<HugeiconsIcon icon={GithubIcon} className="w-5 h-5" />
							</a>
							<ThemeSwitcher />
							{!isPending && !session && <GetStartedButton />}
							{!isPending && session && (
								<Button
									onClick={async () => {
										navigate({ to: "/" });
									}}
								>
									Dashboard
								</Button>
							)}
						</div>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8">
				<div className="max-w-7xl mx-auto">
					<div className="grid lg:grid-cols-2 gap-12 items-center">
						{/* Left side - Text content */}
						<div>
							<Badge variant="outline" className="mb-6">
								Where every point counts
							</Badge>
							<h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 leading-tight">
								Track Your
								<br />
								<span className="text-primary">Competitive Edge</span>
							</h1>
							<p className="text-xl text-muted-foreground mb-8 leading-relaxed">
								The ultimate battleground for settling scores! Whether you are conquering video
								games or dominating office games like pool and darts, track victories, rankings, and
								bragging rights with friends and colleagues.
							</p>
							<div className="flex flex-col sm:flex-row gap-4">
								<GetStartedButton size="lg" className="text-lg px-8 py-6" />
							</div>
							<p className="text-sm text-muted-foreground mt-6">
								Free to use • ELO rankings • Team support
							</p>
						</div>

						{/* Right side - Hero Image */}
						<img
							src="/scorebrawl-monochrome.png"
							alt="Scorebrawl - Track your competitive games"
							className="w-full h-auto object-cover rounded-xl"
						/>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
				<div className="max-w-7xl mx-auto">
					<div className="text-center mb-16">
						<h2 className="text-4xl font-bold text-foreground mb-4">Everything You Need</h2>
						<p className="text-xl text-muted-foreground">
							Create leagues, track matches, and climb the rankings
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
						<Card className="hover:border-primary/50 transition-all">
							<CardHeader>
								<div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<HugeiconsIcon icon={AwardIcon} className="w-6 h-6 text-primary" />
								</div>
								<CardTitle>Create Leagues</CardTitle>
								<CardDescription>
									Set up competitive leagues for any game or sport. From video games to office pool
									and darts.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="hover:border-primary/50 transition-all">
							<CardHeader>
								<div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<HugeiconsIcon icon={Target02Icon} className="w-6 h-6 text-primary" />
								</div>
								<CardTitle>Track Matches</CardTitle>
								<CardDescription>
									Record scores and match results with detailed statistics. Never lose track of who
									won.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="hover:border-primary/50 transition-all">
							<CardHeader>
								<div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<HugeiconsIcon icon={ArrowUp01Icon} className="w-6 h-6 text-primary" />
								</div>
								<CardTitle>ELO Rankings</CardTitle>
								<CardDescription>
									Automatic ELO-based ranking system that adjusts based on match outcomes and
									opponent strength.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="hover:border-primary/50 transition-all">
							<CardHeader>
								<div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<HugeiconsIcon icon={UserMultipleIcon} className="w-6 h-6 text-primary" />
								</div>
								<CardTitle>Team Competition</CardTitle>
								<CardDescription>
									Support for both individual and team-based competitions. Form teams and battle
									together.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="hover:border-primary/50 transition-all">
							<CardHeader>
								<div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<HugeiconsIcon icon={MedalFirstPlaceIcon} className="w-6 h-6 text-primary" />
								</div>
								<CardTitle>Achievements</CardTitle>
								<CardDescription>
									Unlock achievements and celebrate milestones. Earn bragging rights with badges and
									rewards.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="hover:border-primary/50 transition-all">
							<CardHeader>
								<div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<HugeiconsIcon icon={ViewIcon} className="w-6 h-6 text-primary" />
								</div>
								<CardTitle>Live Leaderboards</CardTitle>
								<CardDescription>
									Real-time leaderboards and statistics. Watch your ranking climb as you win more
									matches.
								</CardDescription>
							</CardHeader>
						</Card>
					</div>
				</div>
			</section>

			{/* Pricing Section */}
			<section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
				<div className="max-w-7xl mx-auto">
					<div className="text-center mb-16">
						<h2 className="text-4xl font-bold text-foreground mb-4">Simple Pricing</h2>
						<p className="text-xl text-muted-foreground">Start free, upgrade when you need more</p>
					</div>

					<div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
						{/* Free Plan */}
						<Card
							className={`transition-all ${hoveredPlan === "free" ? "border-primary shadow-lg" : ""}`}
							onMouseEnter={() => setHoveredPlan("free")}
							onMouseLeave={() => setHoveredPlan(null)}
						>
							<CardHeader>
								<CardTitle className="text-2xl">Free</CardTitle>
								<CardDescription>Perfect for casual players</CardDescription>
								<div className="mt-4">
									<span className="text-5xl font-bold text-foreground">$0</span>
									<span className="text-muted-foreground ml-2">forever</span>
								</div>
							</CardHeader>
							<CardContent>
								<ul className="space-y-3">
									<li className="flex items-start gap-2 text-foreground">
										<HugeiconsIcon
											icon={Tick02Icon}
											className="w-5 h-5 text-primary shrink-0 mt-0.5"
										/>
										<span>Unlimited leagues</span>
									</li>
									<li className="flex items-start gap-2 text-foreground">
										<HugeiconsIcon
											icon={Tick02Icon}
											className="w-5 h-5 text-primary shrink-0 mt-0.5"
										/>
										<span>Unlimited players</span>
									</li>
									<li className="flex items-start gap-2 text-foreground">
										<HugeiconsIcon
											icon={Tick02Icon}
											className="w-5 h-5 text-primary shrink-0 mt-0.5"
										/>
										<span>Basic statistics</span>
									</li>
									<li className="flex items-start gap-2 text-foreground">
										<HugeiconsIcon
											icon={Tick02Icon}
											className="w-5 h-5 text-primary shrink-0 mt-0.5"
										/>
										<span>Community support</span>
									</li>
								</ul>
							</CardContent>
						</Card>

						{/* Pro Plan */}
						<Card
							className={`border-primary transition-all relative ${hoveredPlan === "pro" ? "shadow-xl scale-105" : ""}`}
							onMouseEnter={() => setHoveredPlan("pro")}
							onMouseLeave={() => setHoveredPlan(null)}
						>
							<div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
								<Badge>Coming Soon</Badge>
							</div>
							<CardHeader>
								<CardTitle className="text-2xl">Pro</CardTitle>
								<CardDescription>For serious competitors</CardDescription>
								<div className="mt-4">
									<span className="text-5xl font-bold text-foreground">$5</span>
									<span className="text-muted-foreground ml-2">/month</span>
								</div>
							</CardHeader>
							<CardContent>
								<ul className="space-y-3">
									<li className="flex items-start gap-2 text-foreground">
										<HugeiconsIcon
											icon={Tick02Icon}
											className="w-5 h-5 text-primary shrink-0 mt-0.5"
										/>
										<span>Everything in Free</span>
									</li>
									<li className="flex items-start gap-2 text-foreground">
										<HugeiconsIcon
											icon={Tick02Icon}
											className="w-5 h-5 text-primary shrink-0 mt-0.5"
										/>
										<span>Advanced analytics</span>
									</li>
									<li className="flex items-start gap-2 text-foreground">
										<HugeiconsIcon
											icon={Tick02Icon}
											className="w-5 h-5 text-primary shrink-0 mt-0.5"
										/>
										<span>Custom achievements</span>
									</li>
									<li className="flex items-start gap-2 text-foreground">
										<HugeiconsIcon
											icon={Tick02Icon}
											className="w-5 h-5 text-primary shrink-0 mt-0.5"
										/>
										<span>Priority support</span>
									</li>
								</ul>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-20 px-4 sm:px-6 lg:px-8">
				<div className="max-w-4xl mx-auto text-center">
					<h2 className="text-4xl font-bold text-foreground mb-6">Ready to settle some scores?</h2>
					<p className="text-xl text-muted-foreground mb-10">
						Join Scorebrawl today and start tracking your competitive victories
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<GetStartedButton size="lg" className="text-lg px-8 py-6" />
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
				<div className="max-w-7xl mx-auto">
					<div className="grid md:grid-cols-4 gap-8">
						<div className="col-span-2">
							<div className="flex items-center gap-3 mb-4">
								<div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
									<HugeiconsIcon icon={BarChartIcon} className="w-6 h-6 text-primary-foreground" />
								</div>
								<span className="text-2xl font-bold text-foreground">Scorebrawl</span>
							</div>
							<p className="text-muted-foreground mb-6 max-w-md">
								The ultimate battleground for tracking and amplifying your competitive edge. Fuel
								the fun, ignite the rivalry!
							</p>
						</div>

						<div>
							<h3 className="text-foreground font-semibold mb-4">Product</h3>
							<ul className="space-y-2">
								<li>
									<a
										href="/"
										className="text-muted-foreground hover:text-foreground transition-colors"
									>
										Features
									</a>
								</li>
								<li>
									<a
										href="/"
										className="text-muted-foreground hover:text-foreground transition-colors"
									>
										Pricing
									</a>
								</li>
								<li>
									<a
										href="/"
										className="text-muted-foreground hover:text-foreground transition-colors"
									>
										GitHub
									</a>
								</li>
							</ul>
						</div>

						<div>
							<h3 className="text-foreground font-semibold mb-4">Resources</h3>
							<ul className="space-y-2">
								<li>
									<a
										href="/"
										className="text-muted-foreground hover:text-foreground transition-colors"
									>
										Documentation
									</a>
								</li>
								<li>
									<a
										href="/"
										className="text-muted-foreground hover:text-foreground transition-colors"
									>
										Community
									</a>
								</li>
								<li>
									<a
										href="/"
										className="text-muted-foreground hover:text-foreground transition-colors"
									>
										Support
									</a>
								</li>
							</ul>
						</div>
					</div>

					<div className="border-t mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
						<p className="text-muted-foreground text-sm">
							© {new Date().getFullYear()} Scorebrawl. All rights reserved.
						</p>
						<div className="flex gap-6 mt-4 sm:mt-0">
							<a
								href="/"
								className="text-muted-foreground hover:text-foreground transition-colors text-sm"
							>
								Privacy
							</a>
							<a
								href="/"
								className="text-muted-foreground hover:text-foreground transition-colors text-sm"
							>
								Terms
							</a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
};

export default Landing;
