import DateTimePickerDefault from "@expo/ui/community/datetime-picker";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { RefObject } from "react";

import { Fonts, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/hooks/use-theme";
import { useThemeMode } from "@/hooks/use-theme-mode";

interface DateFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	error?: string;
	minimumDate?: Date;
	maximumDate?: Date;
	editable?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	containerRef?: RefObject<View | null>;
}

function parseDate(value: string) {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function toDateInput(date: Date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function formatDisplay(value: string) {
	if (!value) return "";
	return parseDate(value).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function DateField({
	label,
	value,
	onChange,
	placeholder,
	error,
	minimumDate,
	maximumDate,
	editable = true,
	open = false,
	onOpenChange,
	containerRef,
}: DateFieldProps) {
	const theme = useTheme();
	const { themeMode } = useThemeMode();
	const deviceScheme = useColorScheme();
	const resolvedScheme =
		themeMode === "system" ? (deviceScheme === "dark" ? "dark" : "light") : themeMode;

	const currentDate = value ? parseDate(value) : (minimumDate ?? new Date());

	const close = () => onOpenChange?.(false);

	const handleSelect = (date: Date) => {
		onChange(toDateInput(date));
		close();
	};

	return (
		<View ref={containerRef} style={styles.container}>
			<Text style={[styles.label, { color: theme.text }]}>{label}</Text>
			<Pressable
				disabled={!editable}
				onPress={() => onOpenChange?.(!open)}
				style={({ pressed }) => [
					styles.field,
					{
						backgroundColor: theme.background,
						borderColor: error ? theme.destructive : theme.border,
						opacity: editable ? 1 : 0.6,
					},
					pressed && editable && { backgroundColor: theme.backgroundSelected },
				]}
			>
				<Text
					style={[styles.value, { color: value ? theme.text : theme.mutedForeground }]}
					numberOfLines={1}
				>
					{value ? formatDisplay(value) : placeholder || "Select a date"}
				</Text>
			</Pressable>
			{error ? <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text> : null}
			{open ? (
				Platform.OS === "android" ? (
					<DateTimePickerDefault
						value={currentDate}
						mode="date"
						presentation="dialog"
						minimumDate={minimumDate}
						maximumDate={maximumDate}
						themeVariant={resolvedScheme}
						onValueChange={(event, selectedDate) => handleSelect(selectedDate)}
						onDismiss={close}
					/>
				) : (
					<View style={styles.pickerArea}>
						<DateTimePickerDefault
							value={currentDate}
							mode="date"
							display="inline"
							minimumDate={minimumDate}
							maximumDate={maximumDate}
							themeVariant={resolvedScheme}
							onValueChange={(event, selectedDate) => handleSelect(selectedDate)}
						/>
						<Pressable onPress={close} style={styles.doneButton}>
							<Text style={[styles.doneLabel, { color: theme.glowBlueText }]}>Done</Text>
						</Pressable>
					</View>
				)
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		gap: Spacing.two,
	},
	label: {
		fontFamily: Fonts.sans,
		fontWeight: "400",
		fontSize: 14,
		lineHeight: 20,
	},
	field: {
		height: 44,
		borderWidth: 1,
		borderRadius: 0,
		paddingHorizontal: Spacing.three,
		justifyContent: "center",
	},
	value: {
		fontFamily: Fonts.sans,
		fontSize: 16,
	},
	error: {
		fontFamily: Fonts.sans,
		fontSize: 13,
		lineHeight: 18,
	},
	pickerArea: {
		gap: Spacing.two,
	},
	doneButton: {
		alignSelf: "flex-end",
		paddingVertical: Spacing.one,
		paddingHorizontal: Spacing.two,
	},
	doneLabel: {
		fontFamily: Fonts.sans,
		fontWeight: "400",
		fontSize: 15,
	},
});
