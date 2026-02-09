import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
	Camera01Icon,
	Delete01Icon,
	Edit01Icon,
	EyeIcon,
	Key01Icon,
	Link01Icon,
	Logout01Icon,
	Mail01Icon,
	ShieldKeyIcon,
	UserIcon,
} from "hugeicons-react";
import { useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Header } from "@/components/layout/header";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { useSession, useSessionInvalidate, fetchSessionForRoute } from "@/hooks/useSession";

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
	const invalidateSession = useSessionInvalidate();
	const navigate = useNavigate();
	// Use reactive session if available, fallback to route session
	const currentSession = session || routeSession;
	const user = currentSession?.user;

	const [isEditingName, setIsEditingName] = useState(false);
	const [name, setName] = useState(user?.name || "");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [isChangingPassword, setIsChangingPassword] = useState(false);
	const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [optimisticAvatar, setOptimisticAvatar] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
	const [editingPasskeyName, setEditingPasskeyName] = useState("");
	const queryClient = useQueryClient();

	// tRPC
	const trpc = useTRPC();
	const uploadAvatarMutation = useMutation(trpc.user.uploadAvatar.mutationOptions());

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
			setEditingPasskeyId(null);
			setEditingPasskeyName("");
			toast.success("Passkey updated successfully");
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to update passkey");
		},
	});

	const handleUpdateName = async () => {
		if (!user || !name.trim()) return;
		try {
			const { error } = await authClient.updateUser({
				name: name.trim(),
			});
			if (error) {
				toast.error(error.message || "Failed to update name");
				return;
			}
			toast.success("Name updated successfully");
			setIsEditingName(false);
			invalidateSession();
		} catch {
			toast.error("Failed to update name");
		}
	};

	const handleVerifyEmail = async () => {
		try {
			// TODO: Implement email verification when better-auth API is available
			toast.error("Email verification not yet implemented");
			return;
			// const { error } = await authClient.email.sendVerificationEmail({
			// 	email: user?.email || "",
			// })
			// if (error) {
			// 	toast.error(error.message || "Failed to send verification email");
			// 	return;
			// }
			// toast.success("Verification email sent. Please check your inbox");
		} catch {
			toast.error("Failed to send verification email");
		}
	};

	const handleChangePassword = async () => {
		if (!currentPassword || !newPassword) {
			toast.error("Please fill in all fields");
			return;
		}
		if (newPassword.length < 8) {
			toast.error("Password must be at least 8 characters");
			return;
		}
		try {
			const { error } = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions,
			});
			if (error) {
				toast.error(error.message || "Failed to change password");
				return;
			}
			toast.success("Password changed successfully");
			setCurrentPassword("");
			setNewPassword("");
			setIsChangingPassword(false);
			setRevokeOtherSessions(true);
			invalidateSession();
		} catch {
			toast.error("Failed to change password");
		}
	};

	const handleLinkProvider = async (provider: "github" | "google") => {
		try {
			// Use signIn.social for linking accounts
			await authClient.signIn.social({
				provider,
				callbackURL: "/profile",
			});
		} catch {
			toast.error(`Failed to link ${provider}`);
		}
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

	const handleAvatarClick = () => {
		fileInputRef.current?.click();
	};

	const resizeImage = (
		file: File,
		maxWidth: number,
		maxHeight: number,
		quality = 0.8
	): Promise<File> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement("canvas");
					let width = img.width;
					let height = img.height;

					// Calculate new dimensions
					if (width > height) {
						if (width > maxWidth) {
							height = Math.round((height * maxWidth) / width);
							width = maxWidth;
						}
					} else {
						if (height > maxHeight) {
							width = Math.round((width * maxHeight) / height);
							height = maxHeight;
						}
					}

					canvas.width = width;
					canvas.height = height;

					const ctx = canvas.getContext("2d");
					if (!ctx) {
						reject(new Error("Failed to get canvas context"));
						return;
					}

					ctx.drawImage(img, 0, 0, width, height);

					canvas.toBlob(
						(blob) => {
							if (!blob) {
								reject(new Error("Failed to create blob"));
								return;
							}
							const resizedFile = new File([blob], file.name, {
								type: file.type,
								lastModified: Date.now(),
							});
							resolve(resizedFile);
						},
						file.type,
						quality
					);
				};
				img.onerror = reject;
				if (typeof e.target?.result === "string") {
					img.src = e.target.result;
				} else {
					reject(new Error("Failed to read file"));
				}
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	};

	const handleAvatarChange = async (file: File) => {
		if (!user) return;

		// Validate file type
		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}

		// Validate file size (max 5MB before compression)
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image size must be less than 5MB");
			return;
		}

		setIsUploadingAvatar(true);

		try {
			// Resize image to max 512x512 with 0.8 quality to reduce size
			const resizedFile = await resizeImage(file, 512, 512, 0.8);

			// Validate resized file size (max 2MB after compression)
			if (resizedFile.size > 2 * 1024 * 1024) {
				toast.error("Image is too large after compression. Please try a smaller image.");
				setIsUploadingAvatar(false);
				return;
			}

			// Optimistic update - create a preview URL
			const previewUrl = URL.createObjectURL(resizedFile);
			setOptimisticAvatar(previewUrl);

			// Convert file to base64 data URL
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
				reader.readAsDataURL(resizedFile);
			});

			// Upload avatar in single request
			await uploadAvatarMutation.mutateAsync({ imageData });

			// Invalidate session to get updated user data
			invalidateSession();

			// Clean up preview URL
			if (optimisticAvatar) {
				URL.revokeObjectURL(optimisticAvatar);
			}
			setOptimisticAvatar(null);

			toast.success("Avatar uploaded successfully");
		} catch (err) {
			// Revert optimistic update on error
			if (optimisticAvatar) {
				URL.revokeObjectURL(optimisticAvatar);
			}
			setOptimisticAvatar(null);

			toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
		} finally {
			setIsUploadingAvatar(false);
		}
	};

	const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.item(0);
		if (file) {
			await handleAvatarChange(file);
		}
		// Reset input value (following better-auth-ui pattern)
		event.target.value = "";
	};

	return (
		<>
			<Header>
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2" />
				<h1 className="text-lg font-semibold">Profile</h1>
			</Header>
			<div className="flex flex-1 flex-col gap-6 p-6 pt-0">
				<div className="flex flex-col gap-2">
					<h2 className="text-2xl font-semibold">Profile</h2>
					<p className="text-sm text-muted-foreground">
						Manage your account settings and preferences
					</p>
				</div>

				{/* Top Section - Avatar, Name, Email */}
				<Card>
					<CardHeader>
						<CardTitle>Profile Information</CardTitle>
						<CardDescription>Update your profile information and verify your email</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						<div className="flex items-center gap-6">
							<button
								type="button"
								className="relative group cursor-pointer border-0 bg-transparent p-0"
								onClick={handleAvatarClick}
							>
								<Avatar className="h-20 w-20 rounded-lg ring-2 ring-transparent group-hover:ring-primary transition-all pointer-events-none">
									<AvatarImage
										src={optimisticAvatar ?? "/api/user-assets/user-avatar"}
										alt={user?.name || ""}
										className="rounded-lg"
									/>
									<AvatarFallback className="text-lg rounded-lg">
										{getInitials(user?.name)}
									</AvatarFallback>
								</Avatar>
								<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
									<Camera01Icon className="h-6 w-6 text-white" />
								</div>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleAvatarUpload}
									className="hidden"
									disabled={isUploadingAvatar}
								/>
							</button>
							<div className="flex flex-1 flex-col gap-2">
								<div className="flex items-center gap-2">
									{isEditingName ? (
										<div className="flex flex-1 items-center gap-2">
											<Input
												value={name}
												onChange={(e) => setName(e.target.value)}
												className="flex-1"
												placeholder="Name"
											/>
											<Button size="sm" onClick={handleUpdateName}>
												Save
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={() => {
													setName(user?.name || "");
													setIsEditingName(false);
												}}
											>
												Cancel
											</Button>
										</div>
									) : (
										<>
											<h2 className="text-lg font-medium">{user?.name || "No name"}</h2>
											<Button size="icon-sm" variant="ghost" onClick={() => setIsEditingName(true)}>
												<Edit01Icon />
											</Button>
										</>
									)}
								</div>
								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground">{user?.email || "No email"}</span>
									{!user?.emailVerified && (
										<>
											<Badge variant="outline" className="text-xs">
												Unverified
											</Badge>
											<Button size="sm" variant="outline" onClick={handleVerifyEmail}>
												<Mail01Icon className="mr-1" />
												Verify Email
											</Button>
										</>
									)}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Accounts Section */}
				<Card>
					<CardHeader>
						<CardTitle>Accounts</CardTitle>
						<CardDescription>
							Manage your connected accounts and sign in to additional accounts
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div className="flex items-center gap-3">
								<Avatar className="h-10 w-10 rounded-lg">
									<AvatarImage
										src="/api/user-assets/user-avatar"
										alt={user?.name || ""}
										className="rounded-lg"
									/>
									<AvatarFallback className="rounded-lg">{getInitials(user?.name)}</AvatarFallback>
								</Avatar>
								<div className="flex flex-col">
									<span className="text-sm font-medium">{user?.name || "No name"}</span>
									<span className="text-xs text-muted-foreground">{user?.email || "No email"}</span>
								</div>
							</div>
							<Badge variant="secondary">Current Account</Badge>
						</div>
						<Button variant="outline" className="w-full justify-start">
							<Link01Icon className="mr-2" />
							Sign in to an additional account
						</Button>
					</CardContent>
				</Card>

				{/* Security Section */}
				<div className="flex flex-col gap-6">
					<h2 className="text-xl font-semibold">Security</h2>

					{/* Change Password */}
					<Card>
						<CardHeader>
							<CardTitle>Change Password</CardTitle>
							<CardDescription>Enter your current password and a new password</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{isChangingPassword ? (
								<>
									<div className="flex flex-col gap-2">
										<Label htmlFor="current-password">Current Password</Label>
										<Input
											id="current-password"
											type="password"
											value={currentPassword}
											onChange={(e) => setCurrentPassword(e.target.value)}
											placeholder="Current Password"
										/>
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor="new-password">New Password</Label>
										<div className="relative">
											<Input
												id="new-password"
												type={showPassword ? "text" : "password"}
												value={newPassword}
												onChange={(e) => setNewPassword(e.target.value)}
												placeholder="New Password"
											/>
											<Button
												type="button"
												size="icon-sm"
												variant="ghost"
												className="absolute right-2 top-1/2 -translate-y-1/2"
												onClick={() => setShowPassword(!showPassword)}
											>
												<EyeIcon />
											</Button>
										</div>
										<p className="text-xs text-muted-foreground">
											Please use 8 characters at minimum.
										</p>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id="revoke-sessions"
											checked={revokeOtherSessions}
											onCheckedChange={(checked) => setRevokeOtherSessions(checked === true)}
										/>
										<Label htmlFor="revoke-sessions" className="text-sm font-normal cursor-pointer">
											Revoke all other sessions
										</Label>
									</div>
									<div className="flex gap-2">
										<Button onClick={handleChangePassword}>Save</Button>
										<Button
											variant="ghost"
											onClick={() => {
												setIsChangingPassword(false);
												setCurrentPassword("");
												setNewPassword("");
												setRevokeOtherSessions(true);
											}}
										>
											Cancel
										</Button>
									</div>
								</>
							) : (
								<Button
									variant="outline"
									onClick={() => setIsChangingPassword(true)}
									className="w-fit"
								>
									<Key01Icon className="mr-2" />
									Change Password
								</Button>
							)}
						</CardContent>
					</Card>

					{/* Providers */}
					<Card>
						<CardHeader>
							<CardTitle>Providers</CardTitle>
							<CardDescription>Connect your account with a third-party service</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<div className="flex items-center justify-between rounded-lg border p-4">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded bg-foreground text-background">
										GH
									</div>
									<span className="text-sm font-medium">GitHub</span>
								</div>
								<Button size="sm" variant="outline" onClick={() => handleLinkProvider("github")}>
									Link
								</Button>
							</div>
							<div className="flex items-center justify-between rounded-lg border p-4">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-red-500 text-white">
										G
									</div>
									<span className="text-sm font-medium">Google</span>
								</div>
								<Button size="sm" variant="outline" onClick={() => handleLinkProvider("google")}>
									Link
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Two-Factor */}
					<Card>
						<CardHeader>
							<CardTitle>Two-Factor</CardTitle>
							<CardDescription>Add an extra layer of security to your account</CardDescription>
						</CardHeader>
						<CardContent>
							<Button variant="outline" className="w-fit">
								<ShieldKeyIcon className="mr-2" />
								Enable Two-Factor Authentication
							</Button>
						</CardContent>
					</Card>

					{/* Passkeys */}
					<Card>
						<CardHeader>
							<CardTitle>Passkeys</CardTitle>
							<CardDescription>Manage your passkeys for secure access</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{passkeysQuery.isLoading ? (
								<p className="text-sm text-muted-foreground">Loading passkeys...</p>
							) : passkeysQuery.error ? (
								<p className="text-sm text-destructive">
									{passkeysQuery.error instanceof Error
										? passkeysQuery.error.message
										: "Failed to load passkeys"}
								</p>
							) : passkeysQuery.data && passkeysQuery.data.length > 0 ? (
								<div className="flex flex-col gap-3">
									{passkeysQuery.data.map((passkey) => (
										<div
											key={passkey.id}
											className="flex items-center justify-between rounded-lg border p-4"
										>
											<div className="flex flex-1 items-center gap-3">
												<Key01Icon className="h-5 w-5 text-muted-foreground" />
												{editingPasskeyId === passkey.id ? (
													<div className="flex flex-1 items-center gap-2">
														<Input
															value={editingPasskeyName}
															onChange={(e) => setEditingPasskeyName(e.target.value)}
															placeholder="Passkey name"
															className="flex-1"
														/>
														<Button
															size="sm"
															onClick={() => {
																if (editingPasskeyName.trim()) {
																	updatePasskeyMutation.mutate({
																		id: passkey.id,
																		name: editingPasskeyName.trim(),
																	});
																}
															}}
															disabled={updatePasskeyMutation.isPending}
														>
															Save
														</Button>
														<Button
															size="sm"
															variant="ghost"
															onClick={() => {
																setEditingPasskeyId(null);
																setEditingPasskeyName("");
															}}
														>
															Cancel
														</Button>
													</div>
												) : (
													<>
														<div className="flex flex-col">
															<span className="text-sm font-medium">
																{passkey.name || "Unnamed Passkey"}
															</span>
															<span className="text-xs text-muted-foreground">
																{passkey.deviceType}
																{passkey.backedUp && " • Backed up"}
															</span>
														</div>
														<div className="flex items-center gap-2">
															<Button
																size="icon-sm"
																variant="ghost"
																onClick={() => {
																	setEditingPasskeyId(passkey.id);
																	setEditingPasskeyName(passkey.name || "");
																}}
															>
																<Edit01Icon />
															</Button>
															<AlertDialog>
																<AlertDialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8">
																	<Delete01Icon className="h-4 w-4" />
																</AlertDialogTrigger>
																<AlertDialogContent>
																	<AlertDialogHeader>
																		<AlertDialogTitle>Delete Passkey?</AlertDialogTitle>
																		<AlertDialogDescription>
																			Are you sure you want to delete this passkey? This action
																			cannot be undone.
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
														</div>
													</>
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">No passkeys registered yet</p>
							)}
							<Button
								variant="outline"
								size="sm"
								onClick={async () => {
									try {
										await addPasskeyMutation.mutateAsync(undefined);
									} catch (err) {
										console.error("Failed to add passkey:", err);
									}
								}}
								disabled={addPasskeyMutation.isPending}
								className="w-fit"
							>
								<Key01Icon className="mr-2" />
								{addPasskeyMutation.isPending ? "Adding..." : "Add Passkey"}
							</Button>
						</CardContent>
					</Card>

					{/* Sessions */}
					<Card>
						<CardHeader>
							<CardTitle>Sessions</CardTitle>
							<CardDescription>Manage your active sessions and revoke access</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-between rounded-lg border p-4">
								<div className="flex items-center gap-3">
									<UserIcon className="h-5 w-5 text-muted-foreground" />
									<div className="flex flex-col">
										<span className="text-sm font-medium">Current Session</span>
										<span className="text-xs text-muted-foreground">
											{typeof navigator !== "undefined"
												? `${navigator.platform}, ${navigator.userAgent.includes("Chrome") ? "Chrome" : navigator.userAgent.includes("Firefox") ? "Firefox" : navigator.userAgent.includes("Safari") ? "Safari" : "Unknown"}`
												: "Unknown"}
										</span>
									</div>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={async () => {
										await authClient.signOut({
											fetchOptions: {
												onSuccess: () => {
													navigate({ to: "/" });
												},
											},
										});
									}}
								>
									<Logout01Icon className="mr-2" />
									Sign Out
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}
