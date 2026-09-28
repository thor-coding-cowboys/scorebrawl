import { useQuery } from "@tanstack/react-query";

import { CreateMatchModal } from "@/components/create-match-modal";
import { RecordGameModal } from "@/components/record-game-modal";
import { useTRPC } from "@/lib/trpc";

export function CreateMatchFlow({
	isOpen,
	onClose,
	seasonSlug,
}: {
	isOpen: boolean;
	onClose: () => void;
	seasonSlug: string;
}) {
	const trpc = useTRPC();
	const { data: season } = useQuery({
		...trpc.season.getBySlug.queryOptions({ seasonSlug }),
		enabled: isOpen && !!seasonSlug,
	});

	if (!isOpen || !season) return null;

	if (season.scoreType === "1-v-n-elo") {
		return <RecordGameModal isOpen={isOpen} onClose={onClose} seasonSlug={seasonSlug} />;
	}

	return (
		<CreateMatchModal isOpen={isOpen} onClose={onClose} seasonSlug={seasonSlug} season={season} />
	);
}
