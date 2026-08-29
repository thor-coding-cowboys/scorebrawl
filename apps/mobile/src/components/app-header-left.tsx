import { Pressable } from "react-native";
import { Avatar } from "@/components/avatar";

export function AppHeaderLeft() {
	return (
		<Pressable onPress={() => {}} hitSlop={8}>
			<Avatar name="" size={32} />
		</Pressable>
	);
}
