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
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoUpload } from "@/components/ui/logo-upload";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserMultipleIcon, PencilEdit01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { RowCard } from "@/components/ui/row-card";
import { trpcClient, type RouterOutput } from "@/lib/trpc";

// Helper to construct asset URL from key
const getAssetUrl = (key: string | null | undefined): string | null => {
	if (!key) return null;
	// If it's already a full URL, return it
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return key;
	}
	// Construct API URL from key
	return `/api/user-assets/${key}`;
};

function TeamIcon({ logo, name }: { logo: string | null; name: string }) {
	const [hasError, setHasError] = useState(false);
	const logoUrl = getAssetUrl(logo);

	if (!logoUrl || hasError) {
		return (
			<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
				<HugeiconsIcon icon={UserMultipleIcon} className="size-5 text-blue-500" />
			</div>
		);
	}

	return (
		<div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden">
			<img
				src={logoUrl}
				alt={name}
				className="h-full w-full object-cover"
				onError={() => setHasError(true)}
			/>
		</div>
	);
}

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/teams")({
	component: TeamsPage,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

type Team = RouterOutput["leagueTeam"]["list"]["teams"][number];

function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}...`;
}

function TeamsPage() {
	const { slug } = Route.useLoaderData();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
	const [editName, setEditName] = useState("");
	const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const [isLogoRemoved, setIsLogoRemoved] = useState(false);

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canAccess = role === "owner" || role === "editor" || role === "member" || role === "viewer";
	const isEditor = role === "owner" || role === "admin" || role === "editor";

	const { data: userSession } = authClient.useSession();
	const currentUserId = userSession?.user?.id;

	useEffect(() => {
		if (role && !canAccess) {
			toast.error("You do not have permission to access teams. Redirecting...", {
				duration: 3000,
			});
			setTimeout(() => {
				void navigate({ to: "/leagues/$slug", params: { slug } });
			}, 100);
		}
	}, [role, canAccess, navigate, slug]);

	const { data: teamsData, isLoading } = useQuery({
		queryKey: ["teams", slug],
		queryFn: async () => {
			return await trpcClient.leagueTeam.list.query({});
		},
		enabled: canAccess,
	});

	const teams = useMemo(() => {
		return teamsData?.teams || [];
	}, [teamsData]);

	const totalTeams = teamsData?.totalCount || 0;

	const stats = useMemo(() => {
		if (!teams.length) return { total: 0, withPlayers: 0, avgPlayers: 0 };

		const withPlayers = teams.filter((t) => t.players.length > 0).length;
		const totalPlayers = teams.reduce((acc, t) => acc + t.players.length, 0);
		const avgPlayers = Math.round(totalPlayers / teams.length);

		return {
			total: teams.length,
			withPlayers,
			avgPlayers,
		};
	}, [teams]);

	const editMutation = useMutation({
		mutationFn: async ({ teamId, name }: { teamId: string; name: string }) => {
			return await trpcClient.leagueTeam.edit.mutate({ teamId, name });
		},
		onSuccess: () => {
			toast.success("Team updated");
			void queryClient.invalidateQueries({ queryKey: ["teams", slug] });
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to update team");
		},
	});

	const uploadLogoMutation = useMutation({
		mutationFn: async ({ teamId, imageData }: { teamId: string; imageData: string }) => {
			return await trpcClient.leagueTeam.uploadLogo.mutate({ teamId, imageData });
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["teams", slug] });
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to upload logo");
		},
	});

	const deleteLogoMutation = useMutation({
		mutationFn: async ({ teamId }: { teamId: string }) => {
			return await trpcClient.leagueTeam.deleteLogo.mutate({ teamId });
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["teams", slug] });
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to remove logo");
		},
	});

	const openEditDialog = (team: Team) => {
		setSelectedTeam(team);
		setEditName(team.name);
		setLogoPreview(getAssetUrl(team.logo));
		setSelectedLogo(null);
		setIsLogoRemoved(false);
		setIsEditDialogOpen(true);
	};

	const closeEditDialog = () => {
		// Only revoke if it's a blob URL (newly uploaded preview)
		if (logoPreview?.startsWith("blob:")) {
			URL.revokeObjectURL(logoPreview);
		}
		setIsEditDialogOpen(false);
		setSelectedTeam(null);
		setEditName("");
		setSelectedLogo(null);
		setLogoPreview(null);
		setIsLogoRemoved(false);
	};

	const handleFileSelect = (file: File) => {
		setSelectedLogo(file);
		const previewUrl = URL.createObjectURL(file);
		setLogoPreview(previewUrl);
		setIsLogoRemoved(false);
	};

	const handleRemoveLogo = () => {
		// Only revoke if it's a blob URL (newly uploaded preview)
		if (logoPreview?.startsWith("blob:")) {
			URL.revokeObjectURL(logoPreview);
		}
		setSelectedLogo(null);
		setLogoPreview(null);
		setIsLogoRemoved(true);
	};

	const canEditTeam = (team: Team): boolean => {
		if (isEditor) return true;
		// Members can only edit teams they are part of
		if (!currentUserId) return false;
		// Check if current user is a player in this team
		return team.players.some((p) => p.userId === currentUserId);
	};

	const handleSaveEdit = async () => {
		if (!selectedTeam) {
			closeEditDialog();
			return;
		}

		const nameChanged = editName.trim() && editName !== selectedTeam.name;
		const logoUploaded = selectedLogo !== null;
		const logoRemoved = isLogoRemoved && selectedTeam.logo !== null;
		const hasChanges = nameChanged || logoUploaded || logoRemoved;

		if (!hasChanges) {
			closeEditDialog();
			return;
		}

		try {
			if (nameChanged) {
				await editMutation.mutateAsync({ teamId: selectedTeam.id, name: editName.trim() });
			}

			if (logoUploaded && selectedLogo) {
				const imageData = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => {
						if (typeof reader.result === "string") {
							resolve(reader.result);
						} else {
							reject(new Error("Failed to read file as data URL"));
						}
					};
					reader.onerror = () => reject(new Error("Failed to read file"));
					reader.readAsDataURL(selectedLogo);
				});

				await uploadLogoMutation.mutateAsync({ teamId: selectedTeam.id, imageData });
			}

			if (logoRemoved) {
				await deleteLogoMutation.mutateAsync({ teamId: selectedTeam.id });
			}

			closeEditDialog();
		} catch {
			// Error handling is done in mutation onError callbacks
		}
	};

	if (!canAccess) {
		return null;
	}

	return (
		<>
			<Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && closeEditDialog()}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader className="pb-4 border-b border-border">
						<div className="flex items-center gap-3">
							<div className="w-2 h-6 bg-blue-500 rounded-full" />
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								Edit Team
							</DialogTitle>
						</div>
						<DialogDescription className="font-mono text-sm text-muted-foreground">
							Update the team name and logo.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label>Team Logo (Optional)</Label>
							<LogoUpload
								previewUrl={logoPreview}
								fallback={
									<HugeiconsIcon icon={UserMultipleIcon} className="size-12 text-blue-500" />
								}
								onFileSelect={handleFileSelect}
								onRemove={logoPreview ? handleRemoveLogo : undefined}
								disabled={
									editMutation.isPending ||
									uploadLogoMutation.isPending ||
									deleteLogoMutation.isPending
								}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="name">Team Name</Label>
							<Input
								id="name"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								placeholder="Enter team name"
								maxLength={100}
								disabled={
									editMutation.isPending ||
									uploadLogoMutation.isPending ||
									deleteLogoMutation.isPending
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							onClick={handleSaveEdit}
							disabled={
								editMutation.isPending ||
								uploadLogoMutation.isPending ||
								deleteLogoMutation.isPending ||
								((!editName.trim() || editName === selectedTeam?.name) &&
									!selectedLogo &&
									!isLogoRemoved)
							}
						>
							{editMutation.isPending ||
							uploadLogoMutation.isPending ||
							deleteLogoMutation.isPending
								? "Saving..."
								: "Save changes"}
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
							<BreadcrumbPage>Teams</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</Header>

			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="grid gap-3 md:grid-cols-3">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Total Teams</CardTitle>
							<HugeiconsIcon icon={UserMultipleIcon} className="size-4 text-blue-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.total}</div>
							<p className="text-xs text-muted-foreground">Teams in this league</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Active Teams</CardTitle>
							<HugeiconsIcon icon={UserMultipleIcon} className="size-4 text-emerald-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.withPlayers}</div>
							<p className="text-xs text-muted-foreground">Teams with players assigned</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Avg Players</CardTitle>
							<HugeiconsIcon icon={Add01Icon} className="size-4 text-amber-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.avgPlayers}</div>
							<p className="text-xs text-muted-foreground">Average players per team</p>
						</CardContent>
					</Card>
				</div>

				<div className="bg-muted/50 min-h-[100vh] flex-1 md:min-h-min p-6">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-medium">Teams</h3>
							<span className="text-sm text-muted-foreground">
								Showing {teams.length} of {totalTeams}
							</span>
						</div>

						{isLoading ? (
							<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
								Loading teams...
							</div>
						) : teams.length === 0 ? (
							<div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
									<HugeiconsIcon icon={UserMultipleIcon} className="size-5" />
								</div>
								<p>No teams yet</p>
							</div>
						) : (
							<div className="divide-y divide-border border">
								{teams.map((team) => {
									const canEdit = canEditTeam(team);

									return (
										<RowCard
											key={team.id}
											icon={<TeamIcon logo={team.logo} name={team.name} />}
											title={team.name}
											subtitle={
												<span className="text-muted-foreground">
													{(() => {
														const firstNames = team.players.map(
															(p) => p.name?.split(" ")[0] ?? "Unknown"
														);
														if (firstNames.length === 0) return "No players";
														if (firstNames.length === 1) return firstNames[0];
														if (firstNames.length === 2)
															return `${firstNames[0]} & ${firstNames[1]}`;
														return `${firstNames.slice(0, -1).join(", ")} & ${firstNames[firstNames.length - 1]}`;
													})()}
												</span>
											}
										>
											{canEdit && (
												<Button variant="ghost" size="sm" onClick={() => openEditDialog(team)}>
													<span className="hidden sm:inline">Edit</span>
													<span className="sm:hidden">
														<HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
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
