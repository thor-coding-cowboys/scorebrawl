import { Input } from "@/components/ui/input";

interface DateFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	error?: string;
	editable?: boolean;
}

export function DateField({
	label,
	value,
	onChange,
	placeholder,
	error,
	editable = true,
}: DateFieldProps) {
	return (
		<Input
			label={label}
			value={value}
			onChangeText={onChange}
			placeholder={placeholder || "YYYY-MM-DD"}
			error={error}
			editable={editable}
			autoCapitalize="none"
			autoCorrect={false}
		/>
	);
}
