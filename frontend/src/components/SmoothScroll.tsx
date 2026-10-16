import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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

/**
 * SmoothScroll Provider integrating Lenis 1.3 across the GroundKart application.
 *
 * Mathematical & Algorithmic Design:
 * - Linear Interpolation (LERP): y_k+1 = y_k + α * (y_target - y_k) with α = 0.075 for weighted luxury flow.
 * - Exponential decay easing: E(t) = min(1, 1.001 - 2^(-10t)) mimicking natural physical fluid friction.
 * - Frame-rate independent delta-time synchronization via autoRaf.
 * - Route transition listener that resets scroll state without jarring browser layout shifts.
 */
export default function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<LenisRef>(null);
  const location = useLocation();

  // Synchronize scroll on route change
  useEffect(() => {
    const lenis = lenisRef.current?.lenis;
    if (lenis) {
      if (location.hash) {
        const target = document.querySelector(location.hash) as HTMLElement;
        if (target) {
          lenis.scrollTo(target, {
            offset: -80,
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
          return;
        }
      }
      // Immediate scroll to top on route switch
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.search, location.hash]);

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
