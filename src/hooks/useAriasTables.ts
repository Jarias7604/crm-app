import { useEffect, useRef, useCallback } from 'react';

/**
 * useAriasTables — Hook for the Arias Tables system
 * 
 * Features:
 *  - Dynamic scroll-shadow classes and overflow detection.
 *  - 🖱️ Wheel-to-horizontal-scroll: hold Shift + scroll wheel to scroll
 *    the table left/right. Native trackpad horizontal gestures also work.
 *    Regular vertical scroll is NEVER intercepted (page scrolls normally).
 * 
 * Usage:
 *   const { tableRef, wrapperRef } = useAriasTables();
 *   <div ref={wrapperRef} className="arias-table-wrapper">
 *     <div ref={tableRef} className="arias-table">
 *       <table>...</table>
 *     </div>
 *   </div>
 */
export function useAriasTables() {
    const tableRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback(() => {
        const el = tableRef.current;
        if (!el) return;

        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScroll = scrollWidth - clientWidth;
        const threshold = 5; // px tolerance

        // Show left shadow when scrolled away from start
        if (scrollLeft > threshold) {
            el.classList.add('scrolled-left');
        } else {
            el.classList.remove('scrolled-left');
        }

        // Show right shadow when NOT scrolled to the end
        if (scrollLeft < maxScroll - threshold) {
            el.classList.add('scrolled-right');
        } else {
            el.classList.remove('scrolled-right');
        }
    }, []);

    const checkOverflow = useCallback(() => {
        const el = tableRef.current;
        const wrapper = wrapperRef.current;
        if (!el || !wrapper) return;

        const hasOverflow = el.scrollWidth > el.clientWidth;
        if (hasOverflow) {
            wrapper.classList.add('has-overflow');
        } else {
            wrapper.classList.remove('has-overflow');
        }

        // Also trigger scroll handler to set initial shadow states
        handleScroll();
    }, [handleScroll]);

    useEffect(() => {
        const el = tableRef.current;
        if (!el) return;

        el.addEventListener('scroll', handleScroll, { passive: true });

        // ── Wheel → horizontal scroll ──────────────────────────────────
        // Only converts wheel to horizontal scroll when:
        //   1. Shift key is held (Shift + scroll = horizontal pan), OR
        //   2. The event has a native horizontal delta (trackpad swipe).
        // Plain vertical scroll is NEVER intercepted — page scrolls normally.
        const handleWheel = (e: WheelEvent) => {
            const hasH = el.scrollWidth > el.clientWidth;
            if (!hasH) return;

            // Native horizontal trackpad gesture
            const isNativeHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            // Shift+scroll converts vertical to horizontal
            const isShiftScroll = e.shiftKey && e.deltaY !== 0;

            if (!isNativeHorizontal && !isShiftScroll) return; // let page scroll

            const delta = isNativeHorizontal ? e.deltaX : e.deltaY;
            if (delta === 0) return;

            const { scrollLeft, scrollWidth, clientWidth } = el;
            const maxScroll = scrollWidth - clientWidth;
            const atLeft = scrollLeft <= 0;
            const atRight = scrollLeft >= maxScroll - 1;

            if ((delta > 0 && !atRight) || (delta < 0 && !atLeft)) {
                e.preventDefault();
                el.scrollLeft += delta;
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });

        // Check overflow on mount and on resize
        checkOverflow();
        const resizeObserver = new ResizeObserver(checkOverflow);
        resizeObserver.observe(el);

        return () => {
            el.removeEventListener('scroll', handleScroll);
            el.removeEventListener('wheel', handleWheel);
            resizeObserver.disconnect();
        };
    }, [handleScroll, checkOverflow]);

    return { tableRef, wrapperRef };
}
