import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLenis } from 'lenis/react';

/**
 * BackToTopButton provides a smooth micro-interaction floating button in the bottom-right.
 * Features:
 * - Circular SVG progress indicator illustrating current page scroll depth
 * - Smooth deceleration back to top via Lenis easing
 * - Accessible aria labels and keyboard focus states
 */
export default function BackToTopButton() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const lenis = useLenis();

  useLenis((l) => {
    setScrollProgress(l.progress);
    setIsVisible(l.scroll > 300);
  });

  // Fallback to window scroll if Lenis is absent
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      setIsVisible(scrollY > 300);
      if (totalScroll > 0) {
        setScrollProgress(scrollY / totalScroll);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollTop = () => {
    if (lenis) {
      lenis.scrollTo(0, {
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // SVG circle calculations
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Number.isFinite(scrollProgress) ? Math.min(Math.max(scrollProgress, 0), 1) : 0;
  const strokeDashoffset = circumference - (safeProgress * circumference);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 15 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 right-6 z-40 hidden sm:block"
        >
          <button
            onClick={handleScrollTop}
            aria-label={`Scroll to top (${Math.round(scrollProgress * 100)}% scrolled)`}
            title="Back to top"
            className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-chalk/95 backdrop-blur-md border border-pitch/10 shadow-[0_8px_24px_rgba(6,40,29,0.12)] hover:shadow-[0_12px_32px_rgba(6,40,29,0.2)] text-pitch hover:bg-pitch hover:text-chalk transition-all duration-300 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-marigold"
          >
            {/* Circular Progress Gauge */}
            <svg className="absolute inset-0 w-12 h-12 -rotate-90 pointer-events-none" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-pitch/10 group-hover:stroke-chalk/20"
                strokeWidth="2.5"
                fill="none"
              />
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-marigold transition-all duration-75"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>

            {/* Micro-animated icon */}
            <ArrowUp
              size={18}
              className="group-hover:-translate-y-0.5 transition-transform duration-200 text-pitch group-hover:text-chalk"
            />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
