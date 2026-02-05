import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Header } from "@/components/layout/header";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Add01Icon,
	Mail01Icon,
	Clock01Icon,
	Alert02Icon,
	Cancel01Icon,
	ArrowRight01Icon,
	CheckmarkCircle02Icon,
	UserMultipleIcon,
	UserIcon,
	UserCheck01Icon,
	UserShield01Icon,
} from "@hugeicons/core-free-icons";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RowCard } from "@/components/ui/row-card";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/invitations")({
	component: InvitationsPage,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

interface Invitation {
	id: string;
	organizationId: string;
	email: string;
	role: string | null;
	teamId: string | null;
	status: "pending" | "accepted" | "rejected" | "canceled";
	expiresAt: Date;
	createdAt: Date;
	inviterId: string;
}

const ITEMS_PER_PAGE = 30;

const ROLE_OPTIONS = ["member", "editor", "viewer"] as const;

const roleConfig = {
	member: {
		label: "Member",
		icon: UserIcon,
		color: "blue",
		description: "Can participate and view content",
	},
	editor: {
		label: "Editor",
		icon: UserShield01Icon,
		color: "emerald",
		description: "Can manage content and members",
	},
	viewer: {
		label: "Viewer",
		icon: UserCheck01Icon,
		color: "amber",
		description: "Read-only access to content",
	},
} as const;

function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}...`;
}

function InvitationsPage() {
	const { slug } = Route.useLoaderData();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<string>("member");
	const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
	const [displayLimit, setDisplayLimit] = useState(ITEMS_PER_PAGE);

	const { data: activeMember } = authClient.useActiveMember();

	const role = activeMember?.role;
	const canAccess = role === "owner" || role === "editor";

	useEffect(() => {
		if (role && !canAccess) {
			toast.error("You do not have permission to access invitations. Redirecting...", {
				duration: 3000,
			});
			setTimeout(() => {
				void navigate({ to: "/leagues/$slug", params: { slug } });
			}, 100);
		}
	}, [role, canAccess, navigate, slug]);

	const {
		data: invitationsData,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["invitations", slug],
		queryFn: async () => {
			const { data, error } = await authClient.organization.listInvitations({});
			if (error) {
				throw error;
			}
			return data as Invitation[];
		},
		enabled: canAccess,
	});

	const invitations = invitationsData || [];

	const stats = {
		total: invitations.length,
		pending: invitations.filter((i) => i.status === "pending").length,
		accepted: invitations.filter((i) => i.status === "accepted").length,
	};

	const inviteMutation = useMutation({
		mutationFn: async ({ email, role }: { email: string; role: string }) => {
			const { data, error } = await authClient.organization.inviteMember({
				email,
				role: role as "member" | "admin" | "owner",
			});
			if (error) {
				throw error;
			}
			return data;
		},
		onSuccess: () => {
			toast.success("Invitation sent successfully");
			setInviteEmail("");
			setInviteRole("member");
			setIsInviteDialogOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["invitations", slug] });
			void refetch();
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to send invitation");
		},
	});

	const cancelMutation = useMutation({
		mutationFn: async (invitationId: string) => {
			const { error } = await authClient.organization.cancelInvitation({
				invitationId,
			});
			if (error) {
				throw error;
			}
		},
		onSuccess: () => {
			toast.success("Invitation canceled");
			void queryClient.invalidateQueries({ queryKey: ["invitations", slug] });
			void refetch();
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to cancel invitation");
		},
	});

	const resendMutation = useMutation({
		mutationFn: async ({ email, role }: { email: string; role: string | null }) => {
			const { data, error } = await authClient.organization.inviteMember({
				email,
				role: (role || "member") as "member" | "admin" | "owner",
				resend: true,
			});
			if (error) {
				throw error;
			}
			return data;
		},
		onSuccess: () => {
			toast.success("Invitation resent successfully");
			void queryClient.invalidateQueries({ queryKey: ["invitations", slug] });
			void refetch();
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to resend invitation");
		},
	});

	const handleInvite = () => {
		if (!inviteEmail) {
			toast.error("Please enter an email address");
			return;
		}
		inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
	};

	const handleCancel = (invitationId: string) => {
		cancelMutation.mutate(invitationId);
	};

	const handleResend = (email: string, role: string | null) => {
		resendMutation.mutate({ email, role });
	};

	const handleLoadMore = () => {
		setDisplayLimit((prev) => prev + ITEMS_PER_PAGE);
	};

	const displayedInvitations = invitations.slice(0, displayLimit);
	const hasMore = invitations.length > displayLimit;

	if (!canAccess) {
		return null;
	}

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "pending":
				return <HugeiconsIcon icon={Clock01Icon} className="size-4 text-yellow-500" />;
			case "accepted":
				return <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-green-500" />;
			case "rejected":
				return <HugeiconsIcon icon={Cancel01Icon} className="size-4 text-red-500" />;
			case "canceled":
				return <HugeiconsIcon icon={Alert02Icon} className="size-4 text-gray-500" />;
			default:
				return <HugeiconsIcon icon={Clock01Icon} className="size-4 text-yellow-500" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "pending":
				return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
			case "accepted":
				return "bg-green-500/10 text-green-600 border-green-500/20";
			case "rejected":
				return "bg-red-500/10 text-red-600 border-red-500/20";
			case "canceled":
				return "bg-gray-500/10 text-gray-600 border-gray-500/20";
			default:
				return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
		}
	};

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	return (
		<>
			<Header
				rightContent={
					<GlowButton
						icon={Add01Icon}
						glowColor={glowColors.blue}
						size="sm"
						className="gap-1.5"
						onClick={() => setIsInviteDialogOpen(true)}
					>
						Invitation
					</GlowButton>
				}
			>
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className="hidden md:block">
							<BreadcrumbLink href="#">League</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbLink href={`/leagues/${slug}`}>{truncateSlug(slug)}</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>Invitations</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</Header>
			<Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
				<DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden">
					{/* Technical Grid Background */}
					<div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.02] opacity-[0.05]">
						<div
							className="w-full h-full"
							style={{
								backgroundImage:
									"radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
								backgroundSize: "24px 24px",
							}}
						/>
					</div>

					{/* Header */}
					<DialogHeader className="relative z-10 pb-4 border-b border-border">
						<div className="flex items-center gap-3">
							<div className="w-2 h-6 bg-blue-500 rounded-full shadow-lg shadow-blue-500/25" />
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								Invite Member
							</DialogTitle>
						</div>
						<DialogDescription className="font-mono text-sm text-muted-foreground">
							Send an invitation to join this league. They will receive an email with a link to
							accept.
						</DialogDescription>
					</DialogHeader>

					<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)]">
						<div className="space-y-2 p-1">
							{/* Role Selection */}
							<div className="grid grid-cols-3 gap-2">
								{ROLE_OPTIONS.map((type) => {
									const config = roleConfig[type];
									const isSelected = inviteRole === type;

									// Define explicit classes to ensure Tailwind generates them
									const selectedClasses = {
										member: "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20",
										editor: "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20",
										viewer: "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20",
									};

									const iconClasses = {
										member: "bg-blue-500/20",
										editor: "bg-emerald-500/20",
										viewer: "bg-amber-500/20",
									};

									const iconColorClasses = {
										member: "text-blue-400",
										editor: "text-emerald-400",
										viewer: "text-amber-400",
									};

									const textColorClasses = {
										member: "text-blue-300 dark:text-blue-300",
										editor: "text-emerald-300 dark:text-emerald-300",
										viewer: "text-amber-300 dark:text-amber-300",
									};

									const topBorderClasses = {
										member: "from-blue-400 to-blue-600",
										editor: "from-emerald-400 to-emerald-600",
										viewer: "from-amber-400 to-amber-600",
									};

									return (
										<button
											key={type}
											type="button"
											onClick={() => setInviteRole(type)}
											className={`
                        relative overflow-hidden rounded-lg p-3 border-2 transition-all duration-300
                        ${
													isSelected
														? selectedClasses[type]
														: "border-border bg-card/50 hover:border-border/80 hover:bg-card/80"
												}
                      `}
										>
											{/* Selection Indicator */}
											{isSelected && (
												<div
													className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${topBorderClasses[type]}`}
												/>
											)}

											<div className="flex flex-col items-center space-y-2 text-center">
												<div
													className={`w-6 h-6 rounded-lg ${iconClasses[type]} flex items-center justify-center`}
												>
													<HugeiconsIcon
														icon={config.icon}
														className={`w-4 h-4 ${iconColorClasses[type]}`}
													/>
												</div>

												<div>
													<div
														className={`font-mono text-xs font-bold ${
															isSelected ? textColorClasses[type] : "text-foreground"
														}`}
													>
														{config.label}
													</div>
													<div className="text-xs text-muted-foreground leading-tight">
														{config.description}
													</div>
												</div>
											</div>
										</button>
									);
								})}
							</div>

							<FieldGroup className="space-y-2">
								{/* Email Input */}
								<Field>
									<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
										Email Address
									</FieldLabel>
									<Input
										id="email"
										type="email"
										placeholder="member@example.com"
										value={inviteEmail}
										onChange={(e) => setInviteEmail(e.target.value)}
										className="h-8 font-mono focus:border-blue-500 focus:ring-blue-500/20 text-sm"
									/>
								</Field>
							</FieldGroup>

							{/* Action Buttons */}
							<div className="flex gap-4 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsInviteDialogOpen(false)}
									className="font-mono h-8 text-sm"
								>
									Cancel
								</Button>
								<GlowButton
									glowColor={glowColors.blue}
									onClick={handleInvite}
									disabled={inviteMutation.isPending || !inviteEmail}
									className="flex-1 font-mono h-8 text-sm"
								>
									{inviteMutation.isPending ? "Sending..." : "Send Invitation"}
								</GlowButton>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="grid auto-rows-min gap-3 md:grid-cols-3 xl:grid-cols-3">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),transparent_60%)]" />
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Total Invites</CardTitle>
							<HugeiconsIcon icon={UserMultipleIcon} className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.total}</div>
							<p className="text-xs text-muted-foreground">All invitations sent to date</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(234,179,8,0.12),transparent_60%)]" />
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Pending</CardTitle>
							<HugeiconsIcon icon={Clock01Icon} className="size-4 text-yellow-500" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.pending}</div>
							<p className="text-xs text-muted-foreground">Awaiting response</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),transparent_60%)]" />
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Accepted</CardTitle>
							<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-green-500" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.accepted}</div>
							<p className="text-xs text-muted-foreground">Successfully joined</p>
						</CardContent>
					</Card>
				</div>
				<div className="bg-muted/50 min-h-[100vh] flex-1 md:min-h-min p-6">
					{isLoading ? (
						<div className="flex items-center justify-center h-64">
							<div className="text-muted-foreground">Loading invitations...</div>
						</div>
					) : invitations.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-64 gap-4">
							<HugeiconsIcon icon={Mail01Icon} className="size-12 text-muted-foreground" />
							<p className="text-muted-foreground">No invitations sent yet</p>
							<GlowButton
								icon={Add01Icon}
								glowColor={glowColors.blue}
								variant="outline"
								onClick={() => setIsInviteDialogOpen(true)}
								className="gap-1.5"
							>
								Send First Invitation
							</GlowButton>
						</div>
					) : (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium">Invitations</h3>
								<span className="text-sm text-muted-foreground">
									Showing {displayedInvitations.length} of {invitations.length}
								</span>
							</div>
							<div className="divide-y divide-border border">
								{displayedInvitations.map((invitation) => (
									<RowCard
										key={invitation.id}
										icon={<HugeiconsIcon icon={Mail01Icon} className="size-5 text-primary" />}
										iconClassName="bg-primary/10"
										title={invitation.email}
										subtitle={
											<>
												<span className="capitalize">{invitation.role || "member"}</span>
												<span>•</span>
												<span>Sent {formatDate(invitation.createdAt)}</span>
											</>
										}
									>
										<div
											className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
												invitation.status
											)}`}
										>
											{getStatusIcon(invitation.status)}
											<span className="hidden sm:inline capitalize">{invitation.status}</span>
										</div>
										{(invitation.status === "pending" ||
											new Date(invitation.expiresAt) < new Date()) && (
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleResend(invitation.email, invitation.role)}
													disabled={resendMutation.isPending}
												>
													<span className="hidden sm:inline">Resend</span>
													<span className="sm:hidden text-base">↻</span>
												</Button>
												{invitation.status === "pending" && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleCancel(invitation.id)}
														disabled={cancelMutation.isPending}
													>
														<span className="hidden sm:inline">Cancel</span>
														<span className="sm:hidden text-base">✕</span>
													</Button>
												)}
											</div>
										)}
									</RowCard>
								))}
							</div>
							{hasMore && (
								<div className="flex justify-center pt-4">
									<Button variant="outline" onClick={handleLoadMore} className="gap-1.5">
										Load More
										<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
									</Button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
