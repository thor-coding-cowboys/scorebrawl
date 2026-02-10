import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useSessionInvalidate } from "@/hooks/useSession";

interface EditProfileDialogProps {
	isOpen: boolean;
	onClose: () => void;
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
}

const getInitials = (name?: string | null) => {
	if (!name) return "U";
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
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

export function EditProfileDialog({ isOpen, onClose, user }: EditProfileDialogProps) {
	const trpc = useTRPC();
	const invalidateSession = useSessionInvalidate();
	const [name, setName] = useState(user.name);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [optimisticAvatar, setOptimisticAvatar] = useState<string | null>(null);
	const [avatarMarkedForDeletion, setAvatarMarkedForDeletion] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const uploadAvatarMutation = useMutation(trpc.user.uploadAvatar.mutationOptions());
	const deleteAvatarMutation = useMutation(trpc.user.deleteAvatar.mutationOptions());

	// Build avatar URL with cache busting
	const avatarUrl = user.image
		? `/api/user-assets/${user.image}?t=${Date.now()}`
		: `/api/user-assets/user-avatar?t=${Date.now()}`;

	useEffect(() => {
		setName(user.name);
	}, [user.name]);

	const handleUpdateName = async () => {
		if (!name.trim()) {
			toast.error("Name cannot be empty");
			return;
		}

		try {
			// Handle avatar deletion if marked
			if (avatarMarkedForDeletion) {
				await deleteAvatarMutation.mutateAsync();
			}

			const { error } = await authClient.updateUser({
				name: name.trim(),
			});
			if (error) {
				toast.error(error.message || "Failed to update name");
				return;
			}
			toast.success("Profile updated successfully");
			invalidateSession();
			setAvatarMarkedForDeletion(false);
			onClose();
		} catch {
			toast.error("Failed to update profile");
		}
	};

	const handleAvatarClick = () => {
		fileInputRef.current?.click();
	};

	const handleRemoveAvatar = (event: React.MouseEvent) => {
		event.stopPropagation();
		setAvatarMarkedForDeletion(true);
		setOptimisticAvatar(null);
	};

	const handleAvatarChange = async (file: File) => {
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

			toast.success("Avatar uploaded successfully");

			// Keep the optimistic avatar until dialog closes
			// Don't clean it up here - it will be cleaned up on cancel/close
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
		// Reset input value
		event.target.value = "";
	};

	const handleCancel = () => {
		setName(user.name);
		setAvatarMarkedForDeletion(false);
		if (optimisticAvatar) {
			URL.revokeObjectURL(optimisticAvatar);
			setOptimisticAvatar(null);
		}
		onClose();
	};

	// Determine what avatar to show
	const displayAvatar = avatarMarkedForDeletion ? null : (optimisticAvatar ?? avatarUrl);
	const showRemoveButton = !avatarMarkedForDeletion && (optimisticAvatar || user.image);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
			<DialogContent className="sm:max-w-xl max-h-[95vh] overflow-hidden p-0">
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
				<DialogHeader className="relative z-10 pb-4 border-b border-border p-6">
					<div className="flex items-center gap-3">
						<div className="w-2 h-6 bg-purple-500 rounded-full shadow-lg shadow-purple-500/25" />
						<DialogTitle className="text-xl font-bold font-mono tracking-tight">
							Edit Profile
						</DialogTitle>
					</div>
					<p className="text-sm text-muted-foreground mt-2">
						Update your profile information and avatar
					</p>
				</DialogHeader>

				<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)] p-6">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void handleUpdateName();
						}}
						className="space-y-6"
					>
						{/* Avatar Upload */}
						<div className="flex flex-col items-center gap-4">
							<div className="relative group">
								<button
									type="button"
									className="relative cursor-pointer border-0 bg-transparent p-0"
									onClick={handleAvatarClick}
									disabled={isUploadingAvatar}
								>
									<Avatar className="h-24 w-24 rounded-lg ring-2 ring-transparent group-hover:ring-purple-500 transition-all pointer-events-none">
										<AvatarImage
											src={displayAvatar ?? undefined}
											alt={user.name || ""}
											className="rounded-lg"
										/>
										<AvatarFallback className="text-2xl rounded-lg">
											{getInitials(user.name)}
										</AvatarFallback>
									</Avatar>
									<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
										<HugeiconsIcon icon={Camera01Icon} className="h-8 w-8 text-white" />
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
								{showRemoveButton && (
									<button
										type="button"
										onClick={handleRemoveAvatar}
										className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 bg-red-600 text-white border border-red-600 flex items-center justify-center transition-opacity pointer-events-auto z-10"
										aria-label="Remove avatar"
										disabled={isUploadingAvatar}
									>
										<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
									</button>
								)}
							</div>
							<p className="text-xs text-muted-foreground text-center">
								Click to upload a new avatar
								<br />
								Max 5MB, will be resized to 512x512
							</p>
						</div>

						<FieldGroup className="space-y-4">
							{/* Name */}
							<Field>
								<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
									Name
								</FieldLabel>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="h-8 font-mono focus:border-purple-500 focus:ring-purple-500/20 text-sm"
									placeholder="Your name"
								/>
							</Field>

							{/* Email (read-only) */}
							<Field>
								<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
									Email
								</FieldLabel>
								<Input
									value={user.email}
									disabled
									className="h-8 font-mono text-sm bg-muted cursor-not-allowed"
								/>
								<p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
							</Field>
						</FieldGroup>

						{/* Action Buttons */}
						<div className="flex gap-4 pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={handleCancel}
								className="font-mono h-8 text-sm"
							>
								Cancel
							</Button>
							<GlowButton
								type="submit"
								glowColor={glowColors.blue}
								disabled={isUploadingAvatar || !name.trim()}
								className="flex-1 font-mono h-8 text-sm"
							>
								{isUploadingAvatar ? "Uploading..." : "Save Changes"}
							</GlowButton>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
