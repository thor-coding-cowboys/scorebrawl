import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
	fn: T,
	delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	const debounced = (...args: Parameters<T>) => {
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
	debounced.cancel = () => {
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = null;
	};
	return debounced;
}
