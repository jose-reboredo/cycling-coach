import { useEffect, useRef, type RefObject } from 'react';

interface FocusTrapOptions {
  /** Restore focus to the previously-focused element on cleanup. Default: true. */
  restore?: boolean;
}

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.hasAttribute('aria-hidden'),
  );
}

/**
 * Trap Tab / Shift+Tab inside the element attached to the returned ref while
 * `active` is true. Optionally restores focus to whatever was focused before
 * activation when the hook unmounts or `active` flips to false.
 *
 * Usage:
 *   const ref = useFocusTrap<HTMLDivElement>(open);
 *   return <div ref={ref}>...</div>;
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
  opts: FocusTrapOptions = {},
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { restore = true } = opts;

  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = getFocusable(ref.current);
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      const activeEl = document.activeElement;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (restore) previouslyFocused?.focus?.();
    };
  }, [active, restore]);

  return ref;
}
