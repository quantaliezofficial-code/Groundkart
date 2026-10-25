import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { ReactLenis, useLenis } from 'lenis/react';
import type { LenisRef } from 'lenis/react';
import Lenis from 'lenis';

interface SmoothScrollContextType {
  lenis: Lenis | undefined;
  scrollTo: (target: string | number | HTMLElement, options?: Parameters<Lenis['scrollTo']>[1]) => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextType>({
  lenis: undefined,
  scrollTo: () => {},
});

/**
 * Hook to access Lenis instance methods and high-performance smooth scrolling controls.
 */
export const useSmoothScroll = () => useContext(SmoothScrollContext);

interface SmoothScrollProps {
  children: React.ReactNode;
}

const SCROLL_POSITIONS_STORAGE_KEY = 'groundkart_scroll_positions';

const getInitialScrollPositions = (): Record<string, number> => {
  try {
    const raw = sessionStorage.getItem(SCROLL_POSITIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * SmoothScroll Provider integrating Lenis 1.3 across the GroundKart application.
 *
 * Mathematical & Algorithmic Design:
 * - Linear Interpolation (LERP): y_k+1 = y_k + α * (y_target - y_k) with α = 0.075 for weighted luxury flow.
 * - Exponential decay easing: E(t) = min(1, 1.001 - 2^(-10t)) mimicking natural physical fluid friction.
 * - Frame-rate independent delta-time synchronization via autoRaf.
 * - Intelligent route transition listener: preserves and restores scroll position on POP (back/forward)
 *   navigations, while resetting to top on forward/new page PUSH navigations.
 */
export default function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<LenisRef>(null);
  const location = useLocation();
  const navType = useNavigationType();

  const prevPathname = useRef(location.pathname);
  const scrollPositionsRef = useRef<Record<string, number>>(getInitialScrollPositions());
  const currentRouteKeyRef = useRef(location.key || (location.pathname + location.search));

  // Continuously record scroll position for the current page
  useEffect(() => {
    currentRouteKeyRef.current = location.key || (location.pathname + location.search);

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const key = currentRouteKeyRef.current;
          if (key) {
            scrollPositionsRef.current[key] = scrollY;
            scrollPositionsRef.current[location.pathname + location.search] = scrollY;
            try {
              sessionStorage.setItem(
                SCROLL_POSITIONS_STORAGE_KEY,
                JSON.stringify(scrollPositionsRef.current)
              );
            } catch {
              // Ignore storage quota/access errors
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [location.pathname, location.search, location.key]);

  // Synchronize scroll on route change
  useEffect(() => {
    const isNewPage = prevPathname.current !== location.pathname;
    prevPathname.current = location.pathname;
    currentRouteKeyRef.current = location.key || (location.pathname + location.search);

    const lenis = lenisRef.current?.lenis;

    // Handle hash links if specified (e.g. #results-grid)
    if (location.hash) {
      const target = document.querySelector(location.hash) as HTMLElement;
      if (target) {
        if (lenis) {
          lenis.scrollTo(target, {
            offset: -80,
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        } else {
          target.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }
    }

    // On POP navigation (browser back/forward button), restore previous scroll position
    if (navType === 'POP') {
      const targetKey = location.key || (location.pathname + location.search);
      const targetY =
        scrollPositionsRef.current[targetKey] ??
        scrollPositionsRef.current[location.pathname + location.search] ??
        0;

      const performRestore = () => {
        if (lenis) {
          lenis.scrollTo(targetY, { immediate: true });
        }
        window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });
      };

      performRestore();
      // Secondary frame check in case layout/DOM content takes a tick to render
      const rafId = window.requestAnimationFrame(performRestore);
      return () => window.cancelAnimationFrame(rafId);
    }

    // Immediate scroll to top on actual route switch (not on in-page query changes)
    if (isNewPage) {
      if (lenis) {
        lenis.scrollTo(0, { immediate: true });
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [location.pathname, location.search, location.hash, location.key, navType]);

  const scrollTo = (target: string | number | HTMLElement, options?: Parameters<Lenis['scrollTo']>[1]) => {
    const lenis = lenisRef.current?.lenis;
    if (lenis) {
      lenis.scrollTo(target, {
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        ...options,
      });
    } else if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: 'smooth' });
    } else if (typeof target === 'string') {
      const element = document.querySelector(target);
      element?.scrollIntoView({ behavior: 'smooth' });
    } else if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Exponential decay easing function for natural viscous fluid damping:
  // E(t) = min(1, 1.001 - 2^(-10 * t))
  const smoothEasing = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={{
        lerp: 0.075, // Smooth slow scrolling interpolation parameter
        duration: 1.4, // Extended deceleration window for luxury feel
        easing: smoothEasing,
        smoothWheel: true,
        wheelMultiplier: 0.85, // Slower, more controlled mouse wheel response
        touchMultiplier: 1.6,
        syncTouch: false, // Preserves natural 120Hz touch device inertia on mobile
        autoRaf: true,
      }}
    >
      <SmoothScrollContext.Provider value={{ lenis: lenisRef.current?.lenis, scrollTo }}>
        {children}
      </SmoothScrollContext.Provider>
    </ReactLenis>
  );
}

export { useLenis };
