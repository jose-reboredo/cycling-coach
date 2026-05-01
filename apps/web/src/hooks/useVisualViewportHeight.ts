// useVisualViewportHeight — Sprint 5 / v9.7.5 (#69).
// Tracks `window.visualViewport.height` so modals can size to the actual
// visible viewport. On iOS Safari, when the keyboard opens, the visual
// viewport shrinks but `100dvh` does NOT react. Without this hook, focused
// inputs slide above the visible area (the v9.7.4 bug founder reported on
// ClubCreateModal).
//
// Returns the current visualViewport.height in px, or `null` if the
// browser doesn't support visualViewport (rare; very old browsers).
// Updates on resize + scroll events.

import { useEffect, useState } from 'react';

export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.visualViewport?.height ?? null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onChange = () => setHeight(vv.height);
    onChange();
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    return () => {
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
    };
  }, []);

  return height;
}
