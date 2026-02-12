import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Delete01Icon,
	Edit01Icon,
	Key01Icon,
	Logout01Icon,
	UserIcon,
	Award01Icon,
	Target01Icon,
	SecurityLockIcon,
	Alert02Icon,
	Copy01Icon,
	Add01Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RowCard } from "@/components/ui/row-card";
import { Header } from "@/components/layout/header";
import { authClient } from "@/lib/auth-client";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { EditPasskeyDialog } from "@/components/profile/edit-passkey-dialog";
import { CreateApiKeyDialog } from "@/components/devices/create-api-key-dialog";
import { EditApiKeyDialog } from "@/components/devices/edit-api-key-dialog";
import { useSession, fetchSessionForRoute } from "@/hooks/useSession";
import { useSignOut } from "@/hooks/useSignOut";
import { useTRPC } from "@/lib/trpc";

export const Route = createFileRoute("/_authenticated/_sidebar/profile")({
	component: ProfilePage,
	beforeLoad: async ({ location, context }) => {
		const session = await fetchSessionForRoute(context.queryClient);
		if (!session) {
			throw redirect({
				to: "/auth/sign-in",
				search: {
					redirect: location.href,
				},
			});
		}
		return { session };
	},
});

function ProfilePage() {
	const { session: routeSession } = Route.useRouteContext();
	const { data: session } = useSession();
	const signOut = useSignOut();
	// Use reactive session if available, fallback to route session
	const currentSession = session || routeSession;
	const user = currentSession?.user;

	const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
	const [editingPasskey, setEditingPasskey] = useState<{ id: string; name: string } | null>(null);
	const [isRevokeOtherDialogOpen, setIsRevokeOtherDialogOpen] = useState(false);
	const [isRevokeAllDialogOpen, setIsRevokeAllDialogOpen] = useState(false);
	const [isCreateApiKeyOpen, setIsCreateApiKeyOpen] = useState(false);
	const [editingApiKey, setEditingApiKey] = useState<{ id: string; name: string } | null>(null);
	const [newApiKeyValue, setNewApiKeyValue] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const trpc = useTRPC();

	// Get user stats
	const { data: leaguesData } = useQuery(trpc.league.list.queryOptions());
	const leagueCount = leaguesData?.leagues.length || 0;

	const { data: totalMatches = 0 } = useQuery(trpc.user.getTotalMatches.queryOptions());

	// Passkey queries and mutations
	const passkeysQuery = useQuery({
		queryKey: ["passkeys"],
		queryFn: async () => {
			const { data, error } = await authClient.passkey.listUserPasskeys({});
			if (error) {
				throw new Error(error.message || "Failed to load passkeys");
			}
			return data;
		},
	});

	// Sessions query
	const sessionsQuery = useQuery({
		queryKey: ["sessions"],
		queryFn: async () => {
			const { data, error } = await authClient.listSessions();
			console.log("Sessions data:", data);
			if (error) {
				throw new Error(error.message || "Failed to load sessions");
			}
			return data;
		},
	});

	// API keys query - using Better Auth's built-in apiKey client
	const apiKeysQuery = useQuery({
		queryKey: ["api-keys"],
		queryFn: async () => {
			const { data, error } = await authClient.apiKey.list();
			if (error) {
				throw new Error(error.message || "Failed to load API keys");
			}
			return data;
		},
	});

	const addPasskeyMutation = useMutation({
		mutationFn: async (name?: string) => {
			try {
				const result = await authClient.passkey.addPasskey({
					name,
				});
				const { data, error } = result;

				// Passkey responses always return data object, even on error
				if (error || (data && typeof data === "object" && "error" in data && data.error)) {
					const errorMessage =
						error?.message ||
						(data && typeof data === "object" && "error" in data && data.error
							? (data.error as { message?: string }).message
							: undefined) ||
						"Failed to add passkey";
					console.error("Passkey add error:", errorMessage);
					throw new Error(errorMessage);
				}
				return data;
			} catch (err) {
				console.error("Exception in addPasskey:", err);
				throw err;
			}
		},
		mutationKey: ["addPasskey"],
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
			toast.success("Passkey added successfully");
		},
		onError: (err) => {
			console.error("Add passkey error:", err);
			toast.error(err instanceof Error ? err.message : "Failed to add passkey");
		},
		onSettled: () => {
			// Reset mutation state after completion (success or error)
			addPasskeyMutation.reset();
		},
	});

	const deletePasskeyMutation = useMutation({
		mutationFn: async (id: string) => {
			const { data, error } = await authClient.passkey.deletePasskey({ id });
			if (error) {
				throw new Error(error.message || "Failed to delete passkey");
			}
			return data;
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
			toast.success("Passkey deleted successfully");
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to delete passkey");
		},
	});

	const updatePasskeyMutation = useMutation({
		mutationFn: async ({ id, name }: { id: string; name: string }) => {
			const { data, error } = await authClient.passkey.updatePasskey({
				id,
				name,
			});
			if (error) {
				throw new Error(error.message || "Failed to update passkey");
			}
			return data;
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
			setEditingPasskey(null);
			toast.success("Passkey updated successfully");
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to update passkey");
		},
	});

	const revokeOtherSessionsMutation = useMutation({
		mutationFn: async () => {
			const { data, error } = await authClient.revokeOtherSessions();
			if (error) {
				throw new Error(error.message || "Failed to revoke sessions");
			}
			return data;
		},
		onSuccess: async () => {
			toast.success("All other sessions revoked successfully");
			setIsRevokeOtherDialogOpen(false);
			await queryClient.invalidateQueries({ queryKey: ["sessions"] });
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to revoke sessions");
		},
	});

	const revokeAllSessionsMutation = useMutation({
		mutationFn: async () => {
			const { data, error } = await authClient.revokeSessions();
			if (error) {
				throw new Error(error.message || "Failed to revoke all sessions");
			}
			return data;
		},
		onSuccess: async () => {
			toast.success("All sessions revoked");
			setIsRevokeAllDialogOpen(false);
			// Sign out and clear cache
			await signOut();
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to revoke all sessions");
		},
	});

	// API key mutations - using Better Auth's built-in apiKey client
	const createApiKeyMutation = useMutation({
		mutationFn: async (name: string) => {
			const { data, error } = await authClient.apiKey.create({ name });
			if (error) {
				throw new Error(error.message || "Failed to create API key");
			}
			return data;
		},
		onSuccess: (data) => {
			toast.success("API key created");
			setNewApiKeyValue(data.key);
			setIsCreateApiKeyOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to create API key");
		},
	});

	const updateApiKeyMutation = useMutation({
		mutationFn: async ({ keyId, name }: { keyId: string; name: string }) => {
			const { error } = await authClient.apiKey.update({ keyId, name });
			if (error) {
				throw new Error(error.message || "Failed to update API key");
			}
		},
		onSuccess: () => {
			toast.success("API key updated");
			setEditingApiKey(null);
			void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to update API key");
		},
	});

	const deleteApiKeyMutation = useMutation({
		mutationFn: async (keyId: string) => {
			const { error } = await authClient.apiKey.delete({ keyId });
			if (error) {
				throw new Error(error.message || "Failed to delete API key");
			}
		},
		onSuccess: () => {
			toast.success("API key deleted");
			void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to delete API key");
		},
	});

	const handleCopyApiKey = async (key: string) => {
		try {
			await navigator.clipboard.writeText(key);
			toast.success("API key copied to clipboard");
		} catch {
			toast.error("Failed to copy API key");
		}
	};

	const formatApiKeyDate = (date: Date) => {
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const getInitials = (name?: string | null) => {
		if (!name) return "U";
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	const parseUserAgent = (userAgent: string | null | undefined) => {
		if (!userAgent) return "Unknown Device";

		const browser = userAgent.includes("Chrome")
			? "Chrome"
			: userAgent.includes("Firefox")
				? "Firefox"
				: userAgent.includes("Safari")
					? "Safari"
					: userAgent.includes("Edge")
						? "Edge"
						: "Unknown Browser";

		const platform = userAgent.includes("Windows")
			? "Windows"
			: userAgent.includes("Mac")
				? "macOS"
				: userAgent.includes("Linux")
					? "Linux"
					: userAgent.includes("Android")
						? "Android"
						: userAgent.includes("iOS") ||
							  userAgent.includes("iPhone") ||
							  userAgent.includes("iPad")
							? "iOS"
							: "Unknown OS";

		return `${platform}, ${browser}`;
	};

	const formatSessionDate = (date: Date | string | null | undefined) => {
		if (!date) return "Unknown";
		const d = typeof date === "string" ? new Date(date) : date;
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
	};

	if (!user) {
		return null;
	}

	// Add timestamp to bust cache after avatar changes
	const avatarUrl = user.image
		? `/api/user-assets/${user.image}?t=${Date.now()}`
		: `/api/user-assets/user-avatar?t=${Date.now()}`;

	return (
		<>
			<Header breadcrumbs={[{ name: "Profile" }]} />
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				{/* Profile Header - Centered Avatar and Name */}
				<div className="flex flex-col items-center gap-4 py-8">
					<Avatar className="h-32 w-32 rounded-lg ring-4 ring-border">
						<AvatarImage src={avatarUrl} alt={user.name || ""} className="rounded-lg" />
						<AvatarFallback className="rounded-lg text-4xl">
							{getInitials(user.name)}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col items-center gap-2">
						<h2 className="text-2xl font-bold">{user.name}</h2>
						<p className="text-sm text-muted-foreground">{user.email}</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsEditProfileOpen(true)}
							className="mt-2 gap-1.5"
						>
							<HugeiconsIcon icon={Edit01Icon} className="size-4" />
							Edit Profile
						</Button>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid gap-3 md:grid-cols-2">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Leagues</CardTitle>
							<HugeiconsIcon icon={Award01Icon} className="size-4 text-purple-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{leagueCount}</div>
							<p className="text-xs text-muted-foreground">Active leagues</p>
						</CardContent>
					</Card>

					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Matches</CardTitle>
							<HugeiconsIcon icon={Target01Icon} className="size-4 text-blue-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{totalMatches}</div>
							<p className="text-xs text-muted-foreground">Total matches played</p>
						</CardContent>
					</Card>
				</div>

				{/* Passkeys Section */}
				<div className="bg-muted/50 p-6">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-medium">Passkeys</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={async () => {
									try {
										await addPasskeyMutation.mutateAsync(undefined);
									} catch (err) {
										console.error("Failed to add passkey:", err);
									}
								}}
								disabled={addPasskeyMutation.isPending}
								className="text-muted-foreground hover:text-blue-500"
							>
								<span className="hidden sm:inline">
									{addPasskeyMutation.isPending ? "Adding..." : "Add Passkey"}
								</span>
								<HugeiconsIcon icon={Key01Icon} className="sm:hidden size-4" />
							</Button>
						</div>
						{passkeysQuery.isLoading ? (
							<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
								Loading passkeys...
							</div>
						) : passkeysQuery.error ? (
							<div className="flex h-32 items-center justify-center text-sm text-destructive">
								{passkeysQuery.error instanceof Error
									? passkeysQuery.error.message
									: "Failed to load passkeys"}
							</div>
						) : passkeysQuery.data && passkeysQuery.data.length > 0 ? (
							<div className="divide-y divide-border border">
								{passkeysQuery.data.map((passkey) => (
									<RowCard
										key={passkey.id}
										icon={<HugeiconsIcon icon={Key01Icon} className="size-5 text-primary" />}
										iconClassName="bg-primary/10"
										title={passkey.name || "Unnamed Passkey"}
										subtitle={
											<>
												<span>{passkey.deviceType}</span>
												{passkey.backedUp && (
													<>
														<span>•</span>
														<span>Backed up</span>
													</>
												)}
											</>
										}
									>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setEditingPasskey({ id: passkey.id, name: passkey.name || "" });
											}}
										>
											<span className="hidden sm:inline">Edit</span>
											<span className="sm:hidden">
												<HugeiconsIcon icon={Edit01Icon} className="size-4" />
											</span>
										</Button>
										<AlertDialog>
											<AlertDialogTrigger>
												<Button variant="ghost" size="sm" className="hover:text-red-500">
													<span className="hidden sm:inline">Delete</span>
													<span className="sm:hidden">
														<HugeiconsIcon icon={Delete01Icon} className="size-4" />
													</span>
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Delete Passkey?</AlertDialogTitle>
													<AlertDialogDescription>
														Are you sure you want to delete this passkey? This action cannot be
														undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction
														onClick={() => {
															deletePasskeyMutation.mutate(passkey.id);
														}}
														className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														Delete
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</RowCard>
								))}
							</div>
						) : (
							<div className="flex h-32 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
									<HugeiconsIcon icon={Key01Icon} className="size-5" />
								</div>
								<p>No passkeys registered yet</p>
							</div>
						)}
					</div>
				</div>

				{/* API Keys Section */}
				<div className="bg-muted/50 p-6">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-medium">API Keys</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsCreateApiKeyOpen(true)}
								className="text-muted-foreground hover:text-blue-500"
							>
								<span className="hidden sm:inline">Add API Key</span>
								<HugeiconsIcon icon={Add01Icon} className="sm:hidden size-4" />
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							API keys for companion devices like Tallyo to record matches hands-free
						</p>
						{apiKeysQuery.isLoading ? (
							<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
								Loading API keys...
							</div>
						) : apiKeysQuery.error ? (
							<div className="flex h-32 items-center justify-center text-sm text-destructive">
								{apiKeysQuery.error instanceof Error
									? apiKeysQuery.error.message
									: "Failed to load API keys"}
							</div>
						) : apiKeysQuery.data && apiKeysQuery.data.length > 0 ? (
							<div className="divide-y divide-border border">
								{apiKeysQuery.data.map((apiKey) => (
									<RowCard
										key={apiKey.id}
										icon={<HugeiconsIcon icon={Key01Icon} className="size-5 text-primary" />}
										iconClassName="bg-primary/10"
										title={apiKey.name || "Unnamed Key"}
										subtitle={
											<>
												<span className="font-mono">{apiKey.start}...</span>
												<span>•</span>
												<span>Created {formatApiKeyDate(apiKey.createdAt)}</span>
											</>
										}
									>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setEditingApiKey({
													id: apiKey.id,
													name: apiKey.name || "",
												});
											}}
										>
											<span className="hidden sm:inline">Edit</span>
											<span className="sm:hidden">
												<HugeiconsIcon icon={Edit01Icon} className="size-4" />
											</span>
										</Button>
										<AlertDialog>
											<AlertDialogTrigger>
												<Button variant="ghost" size="sm" className="hover:text-red-500">
													<span className="hidden sm:inline">Delete</span>
													<span className="sm:hidden">
														<HugeiconsIcon icon={Delete01Icon} className="size-4" />
													</span>
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Delete API Key?</AlertDialogTitle>
													<AlertDialogDescription>
														Are you sure you want to delete this API key? Any devices using this key
														will no longer be able to access the API.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction
														onClick={() => deleteApiKeyMutation.mutate(apiKey.id)}
														className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														Delete
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</RowCard>
								))}
							</div>
						) : (
							<div className="flex h-32 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
									<HugeiconsIcon icon={Key01Icon} className="size-5" />
								</div>
								<p>No API keys yet</p>
							</div>
						)}
					</div>
				</div>

				{/* Sessions Section */}
				<div className="bg-muted/50 min-h-[100vh] flex-1 md:min-h-min p-6">
					<div className="space-y-4">
						<div className="flex items-center justify-between gap-2">
							<h3 className="text-lg font-medium">Sessions</h3>
							<div className="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsRevokeOtherDialogOpen(true)}
									className="text-muted-foreground hover:text-red-500"
								>
									<span className="hidden sm:inline">Revoke Other</span>
									<HugeiconsIcon icon={SecurityLockIcon} className="sm:hidden size-4" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsRevokeAllDialogOpen(true)}
									className="text-muted-foreground hover:text-red-500"
								>
									<span className="hidden sm:inline">Revoke All</span>
									<HugeiconsIcon icon={SecurityLockIcon} className="sm:hidden size-4" />
								</Button>
							</div>
						</div>
						{sessionsQuery.isLoading ? (
							<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
								Loading sessions...
							</div>
						) : sessionsQuery.error ? (
							<div className="flex h-32 items-center justify-center text-sm text-destructive">
								{sessionsQuery.error instanceof Error
									? sessionsQuery.error.message
									: "Failed to load sessions"}
							</div>
						) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
							<div className="divide-y divide-border border">
								{sessionsQuery.data.map((session) => {
									const isCurrentSession = session.id === currentSession?.session.id;
									return (
										<RowCard
											key={session.id}
											icon={<HugeiconsIcon icon={UserIcon} className="size-5 text-primary" />}
											iconClassName={isCurrentSession ? "bg-green-500/10" : "bg-primary/10"}
											title={
												<div className="flex items-center gap-2">
													<span>
														{isCurrentSession
															? "Current Session"
															: parseUserAgent(session.userAgent)}
													</span>
													{isCurrentSession && (
														<span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 ring-1 ring-inset ring-green-500/20">
															Current
														</span>
													)}
												</div>
											}
											subtitle={
												<>
													<span>{parseUserAgent(session.userAgent)}</span>
													{session.createdAt && (
														<>
															<span>•</span>
															<span>{formatSessionDate(session.createdAt)}</span>
														</>
													)}
												</>
											}
										>
											{isCurrentSession && (
												<Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
													<span className="hidden sm:inline">Sign Out</span>
													<span className="sm:hidden">
														<HugeiconsIcon icon={Logout01Icon} className="size-4" />
													</span>
												</Button>
											)}
										</RowCard>
									);
								})}
							</div>
						) : (
							<div className="flex h-32 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
									<HugeiconsIcon icon={UserIcon} className="size-5" />
								</div>
								<p>No active sessions</p>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Edit Profile Dialog */}
			<EditProfileDialog
				isOpen={isEditProfileOpen}
				onClose={() => setIsEditProfileOpen(false)}
				user={{ id: user.id, name: user.name, email: user.email, image: user.image }}
			/>

			{/* Edit Passkey Dialog */}
			{editingPasskey && (
				<EditPasskeyDialog
					isOpen={!!editingPasskey}
					onClose={() => setEditingPasskey(null)}
					onSave={(name) => {
						if (editingPasskey) {
							updatePasskeyMutation.mutate({ id: editingPasskey.id, name });
						}
					}}
					currentName={editingPasskey.name}
					isSaving={updatePasskeyMutation.isPending}
				/>
			)}

			{/* Revoke Other Sessions Dialog */}
			<Dialog open={isRevokeOtherDialogOpen} onOpenChange={setIsRevokeOtherDialogOpen}>
				<DialogContent className="sm:max-w-md overflow-hidden">
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
							<div className="w-2 h-6 rounded-full shadow-lg bg-red-500 shadow-red-500/25" />
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								Revoke Other Sessions
							</DialogTitle>
						</div>
					</DialogHeader>

					<div className="relative z-10 space-y-4 py-4">
						{/* Icon */}
						<div className="flex justify-center">
							<div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/10">
								<HugeiconsIcon icon={SecurityLockIcon} className="w-8 h-8 text-red-500" />
							</div>
						</div>

						{/* Content */}
						<div className="text-center space-y-2">
							<h3 className="font-mono font-semibold text-lg">Revoke All Other Sessions</h3>
							<p className="text-muted-foreground text-sm">
								Are you sure you want to revoke all other sessions?
							</p>
						</div>

						{/* Warning Box */}
						<div className="border p-4 space-y-2 bg-red-500/10 border-red-500/20">
							<div className="flex items-start gap-2">
								<HugeiconsIcon
									icon={Alert02Icon}
									className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500"
								/>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground">
										This will sign you out of all other devices and browsers. You will remain signed
										in on this device.
									</p>
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-3 pt-2">
							<Button
								variant="outline"
								onClick={() => setIsRevokeOtherDialogOpen(false)}
								className="flex-1 font-mono h-9 text-sm"
								disabled={revokeOtherSessionsMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								onClick={() => revokeOtherSessionsMutation.mutate()}
								disabled={revokeOtherSessionsMutation.isPending}
								variant="destructive"
								className="flex-1 font-mono font-bold h-9 text-sm"
							>
								{revokeOtherSessionsMutation.isPending ? (
									"Revoking..."
								) : (
									<>
										<HugeiconsIcon icon={SecurityLockIcon} className="w-4 h-4 mr-2" />
										Revoke Other
									</>
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Revoke All Sessions Dialog */}
			<Dialog open={isRevokeAllDialogOpen} onOpenChange={setIsRevokeAllDialogOpen}>
				<DialogContent className="sm:max-w-md overflow-hidden">
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
							<div className="w-2 h-6 rounded-full shadow-lg bg-red-500 shadow-red-500/25" />
							<DialogTitle className="text-xl font-bold font-mono tracking-tight">
								Revoke All Sessions
							</DialogTitle>
						</div>
					</DialogHeader>

					<div className="relative z-10 space-y-4 py-4">
						{/* Icon */}
						<div className="flex justify-center">
							<div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500/10">
								<HugeiconsIcon icon={SecurityLockIcon} className="w-8 h-8 text-red-500" />
							</div>
						</div>

						{/* Content */}
						<div className="text-center space-y-2">
							<h3 className="font-mono font-semibold text-lg">Revoke All Sessions</h3>
							<p className="text-muted-foreground text-sm">
								Are you sure you want to revoke all sessions?
							</p>
						</div>

						{/* Warning Box */}
						<div className="border p-4 space-y-2 bg-red-500/10 border-red-500/20">
							<div className="flex items-start gap-2">
								<HugeiconsIcon
									icon={Alert02Icon}
									className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500"
								/>
								<div className="space-y-1">
									<p className="text-xs text-muted-foreground">
										This will sign you out of ALL devices including this one. You will be redirected
										to the sign-in page.
									</p>
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-3 pt-2">
							<Button
								variant="outline"
								onClick={() => setIsRevokeAllDialogOpen(false)}
								className="flex-1 font-mono h-9 text-sm"
								disabled={revokeAllSessionsMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								onClick={() => revokeAllSessionsMutation.mutate()}
								disabled={revokeAllSessionsMutation.isPending}
								variant="destructive"
								className="flex-1 font-mono font-bold h-9 text-sm"
							>
								{revokeAllSessionsMutation.isPending ? (
									"Revoking..."
								) : (
									<>
										<HugeiconsIcon icon={SecurityLockIcon} className="w-4 h-4 mr-2" />
										Revoke All
									</>
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Create API Key Dialog */}
			<CreateApiKeyDialog
				isOpen={isCreateApiKeyOpen}
				onClose={() => setIsCreateApiKeyOpen(false)}
				onCreate={(name) => createApiKeyMutation.mutate(name)}
				isCreating={createApiKeyMutation.isPending}
			/>

			{/* Edit API Key Dialog */}
			{editingApiKey && (
				<EditApiKeyDialog
					isOpen={!!editingApiKey}
					onClose={() => setEditingApiKey(null)}
					onSave={(name) => {
						if (editingApiKey) {
							updateApiKeyMutation.mutate({ keyId: editingApiKey.id, name });
						}
					}}
					currentName={editingApiKey.name}
					isSaving={updateApiKeyMutation.isPending}
				/>
			)}

			{/* New API Key Display Dialog */}
			{newApiKeyValue && (
				<AlertDialog open={!!newApiKeyValue} onOpenChange={() => setNewApiKeyValue(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>API Key Created</AlertDialogTitle>
							<AlertDialogDescription className="space-y-4">
								<p>
									Copy your API key now. You won't be able to see it again after closing this
									dialog.
								</p>
								<div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
									<code className="flex-1">{newApiKeyValue}</code>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleCopyApiKey(newApiKeyValue)}
										className="flex-shrink-0"
									>
										<HugeiconsIcon icon={Copy01Icon} className="size-4" />
									</Button>
								</div>
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogAction onClick={() => setNewApiKeyValue(null)}>Done</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</>
	);
}
