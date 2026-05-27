import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HugeiconsIcon } from "@hugeicons/react";
import { SentIcon } from "@hugeicons/core-free-icons";

interface MessageInputProps {
	onSend: (content: string) => void;
	disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
	const [content, setContent] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim() || disabled) return;
		onSend(content.trim());
		setContent("");
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="flex items-end gap-2 border-t p-4">
			<Textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Ask about your league..."
				className="min-h-[60px] flex-1 resize-none"
				disabled={disabled}
				rows={2}
			/>
			<Button type="submit" size="icon" disabled={disabled || !content.trim()}>
				<HugeiconsIcon icon={SentIcon} className="size-4" />
			</Button>
		</form>
	);
}
