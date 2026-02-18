import { useEffect, useRef, useCallback } from 'react';

/**
 * useAriasTables — Hook for the Arias Tables system
 * 
 * Adds dynamic scroll-shadow classes and overflow detection.
 * Simply attach the returned ref to your table scroll container div.
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

        // Check overflow on mount and on resize
        checkOverflow();
        const resizeObserver = new ResizeObserver(checkOverflow);
        resizeObserver.observe(el);

        return () => {
            el.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, [handleScroll, checkOverflow]);

    return { tableRef, wrapperRef };
}
