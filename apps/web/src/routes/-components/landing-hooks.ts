import { useEffect, useState } from "react";

/** Tracks which anchored section owns the middle of the viewport. */
export function useActiveSection(ids: readonly string[]) {
	const [active, setActive] = useState<string | null>(null);

	useEffect(() => {
		const elements = ids
			.map((id) => document.getElementById(id))
			.filter((element): element is HTMLElement => element !== null);

		if (elements.length === 0) return;

		let frame = 0;

		const update = () => {
			frame = 0;
			const line = window.innerHeight * 0.35;
			let current: string | null = null;

			for (const element of elements) {
				if (element.getBoundingClientRect().top <= line) current = element.id;
			}

			if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 4) {
				current = elements[elements.length - 1]?.id ?? current;
			}

			setActive(current);
		};

		const schedule = () => {
			if (frame === 0) frame = window.requestAnimationFrame(update);
		};

		update();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);

		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			if (frame !== 0) window.cancelAnimationFrame(frame);
		};
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
