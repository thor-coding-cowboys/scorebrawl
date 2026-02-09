import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Mail01Icon,
	CheckmarkCircle02Icon,
	Loading03Icon,
	Alert02Icon,
} from "@hugeicons/core-free-icons";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/accept-invitation/$invitationId")({
	component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
	const { invitationId } = Route.useParams();
	const navigate = useNavigate();
	const [isAccepting, setIsAccepting] = useState(false);
	const trpc = useTRPC();

	const { data: session, isPending: isSessionLoading } = authClient.useSession();
	const isAuthenticated = !!session?.user;

	const {
		data: invitation,
		isLoading: isInvitationLoading,
		error: invitationError,
	} = useQuery({
		...trpc.member.getInvitationById.queryOptions({ invitationId }),
		enabled: isAuthenticated && !!invitationId,
	});

	// Redirect to sign-in if not authenticated
	if (!isSessionLoading && !isAuthenticated) {
		void navigate({
			to: "/auth/sign-in",
			search: { redirect: `/accept-invitation/${invitationId}` },
		});
		return null;
	}

	// Handle acceptance
	const handleAccept = async () => {
		if (!isAuthenticated) {
			void navigate({
				to: "/auth/sign-in",
				search: { redirect: `/accept-invitation/${invitationId}` },
			});
			return;
		}

		setIsAccepting(true);
		try {
			const { data, error } = await authClient.organization.acceptInvitation({
				invitationId,
			});

			if (error) {
				// Check if it's an email mismatch error
				if (
					error.message?.toLowerCase().includes("email") ||
					error.message?.toLowerCase().includes("match") ||
					error.message?.toLowerCase().includes("recipient")
				) {
					toast.error(
						"This invitation was sent to a different email address. Please sign in with the correct account."
					);
					setTimeout(() => {
						void navigate({ to: "/" });
					}, 3000);
				} else if (error.message?.toLowerCase().includes("expired")) {
					toast.error("Invitation has expired");
					void navigate({ to: "/" });
				} else if (
					error.message?.toLowerCase().includes("accepted") ||
					error.message?.toLowerCase().includes("rejected") ||
					error.message?.toLowerCase().includes("canceled")
				) {
					toast.error(error.message || "Invitation is no longer valid");
					void navigate({ to: "/" });
				} else {
					toast.error(error.message || "Failed to accept invitation");
				}
			} else if (data) {
				toast.success("You have joined the league!");
				void navigate({ to: "/leagues" });
			}
		} catch {
			toast.error("An error occurred while accepting the invitation");
		} finally {
			setIsAccepting(false);
		}
	};

	// Handle decline
	const handleDecline = async () => {
		if (!isAuthenticated) {
			void navigate({ to: "/" });
			return;
		}

		setIsAccepting(true);
		try {
			const { error } = await authClient.organization.rejectInvitation({
				invitationId,
			});

			if (error) {
				toast.error(error.message || "Failed to decline invitation");
			} else {
				toast.success("Invitation declined");
			}
			void navigate({ to: "/" });
		} catch {
			toast.error("An error occurred");
			void navigate({ to: "/" });
		} finally {
			setIsAccepting(false);
		}
	};

	if (isSessionLoading || isInvitationLoading || !isAuthenticated) {
		return (
			<div className="flex min-h-screen items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardContent className="flex flex-col items-center justify-center py-12">
						<HugeiconsIcon icon={Loading03Icon} className="size-12 animate-spin text-primary" />
						<p className="mt-4 text-muted-foreground">Loading...</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (invitationError) {
		return (
			<div className="flex min-h-screen items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
							<HugeiconsIcon icon={Alert02Icon} className="size-8 text-red-500" />
						</div>
						<CardTitle className="text-xl">Cannot Accept Invitation</CardTitle>
						<CardDescription className="text-base mt-2">{invitationError.message}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={() => void navigate({ to: "/" })} className="w-full">
							Go Home
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Toaster position="bottom-center" />
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
						<HugeiconsIcon icon={Mail01Icon} className="size-8 text-primary" />
					</div>
					<CardTitle className="text-2xl">You&apos;ve been invited!</CardTitle>
					<CardDescription className="text-base">
						{invitation?.league ? (
							<div className="mt-4 space-y-4">
								<div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
									<AvatarWithFallback
										src={invitation.league.logo}
										name={invitation.league.name}
										alt={invitation.league.name}
										size="lg"
									/>
									<div className="text-left">
										<p className="font-medium">{invitation.league.name}</p>
										<p className="text-sm text-muted-foreground">League</p>
									</div>
								</div>

								{invitation.inviter && (
									<div className="flex items-center gap-3 text-sm text-muted-foreground">
										<span>Invited by</span>
										<AvatarWithFallback
											src={invitation.inviter.image}
											name={invitation.inviter.name}
											alt={invitation.inviter.name}
											size="sm"
										/>
										<span className="font-medium text-foreground">{invitation.inviter.name}</span>
										{invitation.role && (
											<>
												<span>as</span>
												<span className="capitalize font-medium text-foreground">
													{invitation.role}
												</span>
											</>
										)}
									</div>
								)}
							</div>
						) : (
							<p className="mb-2">You have been invited to join a league</p>
						)}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex gap-3">
						<Button
							variant="outline"
							className="flex-1"
							onClick={handleDecline}
							disabled={isAccepting}
						>
							{isAccepting ? "Processing..." : "Decline"}
						</Button>
						<Button className="flex-1 gap-2" onClick={handleAccept} disabled={isAccepting}>
							{isAccepting ? (
								<>
									<HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
									Processing...
								</>
							) : (
								<>
									<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
									Accept Invitation
								</>
							)}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
