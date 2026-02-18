import { useRef, useEffect, useState, useCallback } from "react";
import type React from "react";

interface UseCarouselOptions {
	autoAdvance?: boolean;
	adaptiveHeight?: boolean;
}

export function useCarousel(
	cardCount: number,
	{ autoAdvance = true, adaptiveHeight = false }: UseCarouselOptions = {}
) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const activeIndexRef = useRef(0);
	const [activeIndex, setActiveIndex] = useState(0);
	const [height, setHeight] = useState<number | undefined>(undefined);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrollSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isTouchingRef = useRef(false);

	const updateHeight = useCallback(
		(index: number) => {
			if (!adaptiveHeight) return;
			const el = scrollRef.current;
			if (!el) return;
			const child = el.children[index] as HTMLElement | undefined;
			if (child) setHeight(child.scrollHeight);
		},
		[adaptiveHeight]
	);

	const stopTimer = () => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = null;
	};

	const scrollTo = (index: number, smooth = true) => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTo({ left: index * el.offsetWidth, behavior: smooth ? "smooth" : "instant" });
		activeIndexRef.current = index;
		setActiveIndex(index);
		updateHeight(index);
	};

	const startTimer = () => {
		if (!autoAdvance) return;
		stopTimer();
		timerRef.current = setTimeout(function advance() {
			if (isTouchingRef.current) {
				startTimer();
				return;
			}
			scrollTo((activeIndexRef.current + 1) % cardCount);
			timerRef.current = setTimeout(advance, 7000);
		}, 7000);
	};

	useEffect(() => {
		updateHeight(0);
		startTimer();
		return () => {
			stopTimer();
			if (scrollSettleRef.current) clearTimeout(scrollSettleRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: startTimer/updateHeight use refs that don't change
	}, []);

	const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		const index = Math.round(el.scrollLeft / el.offsetWidth);
		activeIndexRef.current = index;
		setActiveIndex(index);
		updateHeight(index);
		stopTimer();
		if (scrollSettleRef.current) clearTimeout(scrollSettleRef.current);
		scrollSettleRef.current = setTimeout(() => {
			if (!isTouchingRef.current) startTimer();
		}, 300);
	};

	const onTouchStart = () => {
		isTouchingRef.current = true;
		stopTimer();
	};
	const onTouchEnd = () => {
		isTouchingRef.current = false;
		startTimer();
	};

	const containerStyle: React.CSSProperties = {
		scrollbarWidth: "none",
		...(adaptiveHeight && height != null
			? { height, transition: "height 200ms ease", overflow: "hidden" }
			: {}),
	};

	return { scrollRef, activeIndex, onScroll, onTouchStart, onTouchEnd, containerStyle };
}
