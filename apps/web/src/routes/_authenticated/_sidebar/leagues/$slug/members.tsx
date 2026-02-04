import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Crown02Icon,
	UserShield01Icon,
	UserCheck01Icon,
	UserIcon,
	Edit01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { RowCard } from "@/components/ui/row-card";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/members")({
	component: MembersPage,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

type Member = {
	id: string;
	role: string;
	createdAt?: string | number | Date;
	user?: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	};
	name?: string | null;
	email?: string | null;
	image?: string | null;
};

type MembersData = { members: Member[]; total: number } | Member[];

const ROLE_OPTIONS = ["owner", "editor", "member", "viewer"] as const;

function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}...`;
}

function getInitials(name?: string | null, email?: string | null) {
	const value = name || email || "";
	const parts = value.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "U";
	if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "U";
	return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatRole(role: string) {
	return role.replace(/_/g, " ");
}

function getAssetUrl(key: string | null | undefined): string | undefined {
	if (!key) return undefined;
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return key;
	}
	return `/api/user-assets/${key}`;
}

function MembersPage() {
	const { slug } = Route.useLoaderData();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
	const [selectedMember, setSelectedMember] = useState<Member | null>(null);
	const [selectedRole, setSelectedRole] = useState<string>("member");

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canAccess = role === "owner" || role === "editor";
	const canManageRole = role === "owner" || role === "editor" || role === "admin";

	useEffect(() => {
		if (role && !canAccess) {
			toast.error("You do not have permission to access members. Redirecting...", {
				duration: 3000,
			});
			setTimeout(() => {
				void navigate({ to: "/leagues/$slug", params: { slug } });
			}, 100);
		}
	}, [role, canAccess, navigate, slug]);

	const { data: membersData, isLoading } = useQuery({
		queryKey: ["members", slug],
		queryFn: async () => {
			const { data, error } = await authClient.organization.listMembers();
			if (error) {
				throw error;
			}
			return data as MembersData;
		},
		enabled: canAccess,
	});

	const members = useMemo(() => {
		return Array.isArray(membersData) ? membersData : membersData?.members || [];
	}, [membersData]);

	const totalMembers = Array.isArray(membersData)
		? membersData.length
		: membersData?.total || members.length;

	const roleCounts = useMemo(() => {
		return members.reduce(
			(acc: Record<string, number>, member: Member) => {
				const key = member.role || "member";
				acc[key] = (acc[key] || 0) + 1;
				acc.total += 1;
				return acc;
			},
			{ total: 0 } as Record<string, number>
		);
	}, [members]);

	const growthStats = useMemo(() => {
		const now = Date.now();
		const last30 = now - 30 * 24 * 60 * 60 * 1000;
		const prev30 = now - 60 * 24 * 60 * 60 * 1000;
		let lastCount = 0;
		let prevCount = 0;
		for (const member of members) {
			const createdAt = (member as { createdAt?: string | number | Date }).createdAt;
			if (!createdAt) continue;
			const createdTime = new Date(createdAt).getTime();
			if (createdTime >= last30) {
				lastCount += 1;
			} else if (createdTime >= prev30) {
				prevCount += 1;
			}
		}
		const change = lastCount - prevCount;
		const percent = prevCount > 0 ? Math.round((change / prevCount) * 100) : null;
		return { lastCount, prevCount, change, percent };
	}, [members]);

	const updateRoleMutation = useMutation({
		mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
			const { error } = await authClient.organization.updateMemberRole({
				memberId,
				role,
			});
			if (error) {
				throw error;
			}
		},
		onSuccess: () => {
			toast.success("Member role updated");
			setIsRoleDialogOpen(false);
			setSelectedMember(null);
			void queryClient.invalidateQueries({ queryKey: ["members", slug] });
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to update role");
		},
	});

	const openRoleDialog = (member: Member) => {
		const currentRole = member.role || "member";
		setSelectedMember(member);
		setSelectedRole(currentRole);
		setIsRoleDialogOpen(true);
	};

	if (!canAccess) {
		return null;
	}

	return (
		<>
			<Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>Change member role</DialogTitle>
						<DialogDescription>
							Update access level for{" "}
							{selectedMember?.user?.name || selectedMember?.name || "member"}.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-3">
						<div className="text-sm text-muted-foreground">
							{selectedMember?.user?.email || selectedMember?.email || ""}
						</div>
						<div className="grid gap-2">
							<span className="text-xs font-medium text-muted-foreground">Role</span>
							<Select
								value={selectedRole}
								onValueChange={(value: string | null) => {
									if (!value) return;
									setSelectedRole(value);
								}}
							>
								<SelectTrigger className="h-9">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ROLE_OPTIONS.map((roleOption) => (
										<SelectItem key={roleOption} value={roleOption} className="capitalize">
											{roleOption}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button
							onClick={() => {
								if (!selectedMember || selectedRole === (selectedMember.role || "member")) {
									setIsRoleDialogOpen(false);
									return;
								}
								updateRoleMutation.mutate({ memberId: selectedMember.id, role: selectedRole });
							}}
							disabled={updateRoleMutation.isPending}
						>
							{updateRoleMutation.isPending ? "Saving..." : "Save changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Header>
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
							<BreadcrumbPage>Members</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</Header>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="grid gap-3 md:grid-cols-3">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Owners + Editors</CardTitle>
							<HugeiconsIcon icon={Crown02Icon} className="size-4 text-amber-500" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">
								{(roleCounts.owner || 0) + (roleCounts.editor || 0)}
							</div>
							<p className="text-xs text-muted-foreground">Full access and role control</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Participants</CardTitle>
							<HugeiconsIcon icon={UserCheck01Icon} className="size-4 text-emerald-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">
								{(roleCounts.member || 0) + (roleCounts.viewer || 0)}
							</div>
							<p className="text-xs text-muted-foreground">Members and viewers</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(2,132,199,0.08),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">30-Day Growth</CardTitle>
							<HugeiconsIcon icon={UserShield01Icon} className="size-4 text-sky-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{growthStats.lastCount}</div>
							<p className="text-xs text-muted-foreground">
								{growthStats.percent === null
									? `+${growthStats.change} vs prior 30 days`
									: `${growthStats.percent >= 0 ? "+" : ""}${growthStats.percent}% vs prior 30 days`}
							</p>
						</CardContent>
					</Card>
				</div>
				<div className="bg-muted/50 min-h-[100vh] flex-1 md:min-h-min p-6">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-medium">Members</h3>
							<span className="text-sm text-muted-foreground">
								Showing {members.length} of {totalMembers}
							</span>
						</div>
						{isLoading ? (
							<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
								Loading members...
							</div>
						) : members.length === 0 ? (
							<div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
									<HugeiconsIcon icon={UserIcon} className="size-5" />
								</div>
								No members yet
							</div>
						) : (
							<div className="divide-y divide-border border">
								{members.map((member: Member) => {
									const name = member.user?.name || member.name || "Unknown";
									const email = member.user?.email || member.email || "";
									const image = getAssetUrl(member.user?.image || member.image);
									const currentRole = member.role || "member";
									const canEditThisRole = canManageRole && currentRole !== "owner";

									return (
										<RowCard
											key={member.id}
											icon={
												<Avatar className="h-10 w-10 rounded-lg">
													<AvatarImage src={image} alt={name} className="rounded-lg" />
													<AvatarFallback className="rounded-lg text-sm">
														{getInitials(name, email)}
													</AvatarFallback>
												</Avatar>
											}
											title={name}
											subtitle={
												<>
													<span className="capitalize">{formatRole(currentRole)}</span>
													{email && (
														<>
															<span>•</span>
															<span>{email}</span>
														</>
													)}
												</>
											}
										>
											{canEditThisRole && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => openRoleDialog(member)}
													aria-label="Change role"
												>
													<span className="hidden sm:inline">Change Role</span>
													<span className="sm:hidden">
														<HugeiconsIcon icon={Edit01Icon} className="size-4" />
													</span>
												</Button>
											)}
										</RowCard>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
