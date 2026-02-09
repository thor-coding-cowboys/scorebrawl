import { useRef } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

interface LogoUploadProps {
	/** Current preview URL (blob URL for new uploads, or existing logo URL) */
	previewUrl: string | null;
	/** Fallback content when no image is present */
	fallback: ReactNode;
	/** Called when a file is selected and processed */
	onFileSelect: (file: File) => void;
	/** Called when the remove button is clicked */
	onRemove?: () => void;
	/** Whether the upload is disabled */
	disabled?: boolean;
	/** Image resize options */
	resizeOptions?: {
		maxWidth: number;
		maxHeight: number;
		quality: number;
	};
	/** Max file size in bytes (default: 5MB) */
	maxFileSize?: number;
	/** Additional class names for the container */
	className?: string;
}

const defaultResizeOptions = {
	maxWidth: 256,
	maxHeight: 256,
	quality: 0.7,
};

function resizeImage(
	file: File,
	maxWidth: number,
	maxHeight: number,
	quality: number
): Promise<File> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement("canvas");
				let width = img.width;
				let height = img.height;

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
}

export function LogoUpload({
	previewUrl,
	fallback,
	onFileSelect,
	onRemove,
	disabled = false,
	resizeOptions = defaultResizeOptions,
	maxFileSize = 5 * 1024 * 1024,
	className = "",
}: LogoUploadProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleClick = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.item(0);
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}

		if (file.size > maxFileSize) {
			toast.error(`Image size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`);
			return;
		}

		try {
			const resizedFile = await resizeImage(
				file,
				resizeOptions.maxWidth,
				resizeOptions.maxHeight,
				resizeOptions.quality
			);

			// 1MB limit after resize
			if (resizedFile.size > 1024 * 1024) {
				toast.error("Image is too large after compression. Please try a smaller image.");
				return;
			}

			onFileSelect(resizedFile);
		} catch {
			toast.error("Failed to process image");
		}

		event.target.value = "";
	};

	const handleRemove = (event: React.MouseEvent) => {
		event.stopPropagation();
		onRemove?.();
	};

	return (
		<div className={`flex items-center gap-4 ${className}`}>
			<div className="relative group">
				<button
					type="button"
					className="relative cursor-pointer border-0 bg-transparent p-0"
					onClick={handleClick}
					disabled={disabled}
				>
					<Avatar className="h-24 w-24 rounded-xl ring-2 ring-transparent group-hover:ring-primary transition-all pointer-events-none">
						<AvatarImage
							src={previewUrl ?? undefined}
							alt="Logo"
							className="rounded-xl"
						/>
						<AvatarFallback className="rounded-xl bg-muted">{fallback}</AvatarFallback>
					</Avatar>
					<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
						<HugeiconsIcon icon={Camera01Icon} className="h-8 w-8 text-white" />
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						onChange={handleFileChange}
						className="hidden"
						disabled={disabled}
					/>
				</button>
				{previewUrl && onRemove && (
					<button
						type="button"
						onClick={handleRemove}
						className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 bg-red-600 text-white border border-red-600 flex items-center justify-center transition-opacity pointer-events-auto z-10"
						aria-label="Remove logo"
						disabled={disabled}
					>
						<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
					</button>
				)}
			</div>
			<div className="flex flex-col gap-1">
				<p className="text-sm text-muted-foreground">Click to upload a logo</p>
				<p className="text-xs text-muted-foreground">
					Max {Math.round(maxFileSize / 1024 / 1024)}MB. JPG, PNG, or WebP.
				</p>
			</div>
		</div>
	);
}
