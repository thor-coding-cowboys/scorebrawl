import { Modal } from "react-native";

export function CreateSeasonForm({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	return <Modal visible={isOpen} animationType="slide" onRequestClose={onClose} />;
}
