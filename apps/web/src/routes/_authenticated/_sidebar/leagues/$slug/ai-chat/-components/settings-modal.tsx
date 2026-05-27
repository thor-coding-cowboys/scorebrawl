import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { trpcClient } from "@/lib/trpc";
import { toast } from "sonner";

interface SettingsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const PROVIDER_MODELS: Record<string, string[]> = {
	openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3-mini"],
	opencode: [
		"kimi-k2.6",
		"kimi-k2.5",
		"deepseek-v4-pro",
		"deepseek-v4-flash",
		"glm-5.1",
		"glm-5",
		"qwen3.6-plus",
		"qwen3.5-plus",
		"mimo-v2.5-pro",
		"mimo-v2.5",
	],
};

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
	const queryClient = useQueryClient();
	const { data: settings } = useQuery({
		queryKey: ["ai-settings"],
		queryFn: () => trpcClient.ai.getSettings.query(),
		enabled: open,
	});

	const [provider, setProvider] = useState(settings?.provider ?? "openai");
	const [model, setModel] = useState(settings?.model ?? "");
	const [apiKey, setApiKey] = useState(settings?.apiKey ?? "");

	const updateSettings = useMutation({
		mutationFn: (input: { provider: "openai" | "opencode"; model: string; apiKey: string }) =>
			trpcClient.ai.updateSettings.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
			toast.success("Settings saved");
			onOpenChange(false);
		},
		onError: (err) => {
			toast.error(err.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!model || !apiKey) {
			toast.error("Please fill in all fields");
			return;
		}
		updateSettings.mutate({ provider: provider as "openai" | "opencode", model, apiKey });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>AI Settings</DialogTitle>
					<DialogDescription>Configure your AI provider and API key.</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="provider">Provider</Label>
						<Select value={provider} onValueChange={(v) => setProvider(v || "openai")}>
							<SelectTrigger>
								<SelectValue>{provider}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="openai">OpenAI</SelectItem>
								<SelectItem value="opencode">OpenCode</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="model">Model</Label>
						<Select value={model} onValueChange={(v) => setModel(v || "")}>
							<SelectTrigger>
								<SelectValue>{model || "Select model"}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{PROVIDER_MODELS[provider]?.map((m) => (
									<SelectItem key={m} value={m}>
										{m}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="apiKey">API Key</Label>
						<Input
							id="apiKey"
							type="password"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder="sk-..."
						/>
					</div>
					<Button type="submit" disabled={updateSettings.isPending}>
						{updateSettings.isPending ? "Saving..." : "Save Settings"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
