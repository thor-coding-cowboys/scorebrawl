import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";

import AppTabs from "@/components/app-tabs";

export default function TabsLayout() {
	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<Slot />
			</View>
			<AppTabs />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
	},
});
