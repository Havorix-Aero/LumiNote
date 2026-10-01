import { useEffect, useState } from 'react';

/**
 * Viewport breakpoints.
 *
 * The set is deliberately tiny — the shell only ever needs "is there room for a sidebar" — so
 * components do not each invent their own thresholds.
 */
export const BREAKPOINTS = {
  /** Matches `prefersMobileLayout()` in lib/device.ts. */
  md: 820,
  lg: 1180,
} as const;

export type BreakpointName = 'mobile' | 'tablet' | 'desktop';

function nameOf(width: number): BreakpointName {
  if (width < BREAKPOINTS.md) return 'mobile';
  if (width < BREAKPOINTS.lg) return 'tablet';
  return 'desktop';
}

function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return width;
}

export function useBreakpoint() {
  const width = useViewportWidth();
  return {
    width,
    name: nameOf(width),
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
  };
}
