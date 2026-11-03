import { useEffect, useState } from "react";

/** Tracks which anchored section currently owns the middle of the viewport. */
export function useActiveSection(ids: readonly string[]) {
	const [active, setActive] = useState<string | null>(null);

	useEffect(() => {
		const elements = ids
			.map((id) => document.getElementById(id))
			.filter((element): element is HTMLElement => element !== null);

		if (elements.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

				if (visible) setActive(visible.target.id);
			},
			{ rootMargin: "-32% 0px -58% 0px", threshold: [0, 0.2, 0.5, 1] }
		);

		for (const element of elements) observer.observe(element);
		return () => observer.disconnect();
	}, [ids]);

	return active;
}

/** True once the given element has scrolled above the viewport. Drives the mobile sticky CTA. */
export function usePassedElement(id: string) {
	const [passed, setPassed] = useState(false);

	useEffect(() => {
		const element = document.getElementById(id);
		if (!element) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry) setPassed(!entry.isIntersecting && entry.boundingClientRect.top < 0);
			},
			{ threshold: 0 }
		);

		observer.observe(element);
		return () => observer.disconnect();
	}, [id]);

	return passed;
}
