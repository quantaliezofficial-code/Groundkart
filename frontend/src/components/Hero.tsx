import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { MapPin, Calendar, Grid3x3, Search, ChevronDown, Shield, Zap, Star, ArrowRight, Sparkles } from 'lucide-react';

interface HeroProps {
  locationInput: string;
  onLocationChange: (val: string) => void;
  dateInput: string;
  onDateChange: (val: string) => void;
  categoryInput: string;
  onCategoryChange: (val: string) => void;
  onSearchSubmit: () => void;
}

export default function Hero({
  locationInput,
  onLocationChange,
  dateInput,
  onDateChange,
  categoryInput,
  onCategoryChange,
  onSearchSubmit
}: HeroProps) {
  const bgRef = useRef(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ken burns background effect
    gsap.to(bgRef.current, {
      scale: 1.08,
      duration: 25,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    // Subtle parallax-like movement on background
    const handleMouseMove = (e: MouseEvent) => {
      if (!bgRef.current) return;
      const { innerWidth, innerHeight } = window;
      const xPos = (e.clientX / innerWidth - 0.5) * 20; // max 20px movement
      const yPos = (e.clientY / innerHeight - 0.5) * 20;
      gsap.to(bgRef.current, {
        x: xPos,
        y: yPos,
        duration: 1,
        ease: 'power2.out',
      });
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Floating particle animation
    if (particlesRef.current) {
      const particles = particlesRef.current.children;
      Array.from(particles).forEach((particle, i) => {
        gsap.to(particle, {
          y: 'random(-30, 30)',
          x: 'random(-30, 30)',
          rotation: 'random(-45, 45)',
          duration: 'random(3, 6)',
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          delay: i * 0.2,
        });
      });
    }

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative w-full">
      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative w-full min-h-[560px] sm:min-h-[640px] lg:min-h-[700px] flex flex-col justify-center overflow-hidden">

        {/* ── Background layers ── */}
        {/* Base dark color */}
        <div className="absolute inset-0 bg-[#0a1f14]" />

        {/* Hero image with GSAP Ken Burns */}
        <div
          ref={bgRef}
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{
            backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBaUUVlJuSsUK9Px7YqRsOmjypyDNDBNSe7-PyUqB-GWDlFDMBz4giBM328MGY3xUNl1Nf2LJaH_njc10xNtB1Lhy0dYfLqy5SX0VDmRmBRNIvhOkIGO7WFsnv6cVQ9QoPlQrLfPuNtmjIrpYX99eC76gPDvByFrIeuMeP_pqG-P8SwdIG13mjbXRpllYi3tNTA5rC2PupqOTjDifEm--XCV65wVLOxxzt7W8KLDL5N1gCubiPLXINVkOhdEYHaYqGRrGi6nATIAQ')",
          }}
        />

        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1f14] via-[#0a1f14]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1f14]/40 via-transparent to-[#0a1f14]/40" />

        {/* Subtle radial glow behind text */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-marigold/[0.04] rounded-full blur-3xl pointer-events-none" />

        {/* Decorative floating orbs */}
        <div ref={particlesRef} className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 right-[15%] w-2 h-2 rounded-full bg-marigold/30" />
          <div className="absolute top-40 left-[20%] w-1.5 h-1.5 rounded-full bg-chalk/20" />
          <div className="absolute bottom-48 right-[25%] w-1 h-1 rounded-full bg-marigold/20" />
          <div className="absolute top-1/4 right-[35%] w-2 h-2 rounded-full bg-marigold/10" />
          <div className="absolute bottom-1/3 left-[15%] w-3 h-3 rounded-full bg-chalk/10" />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-36 sm:pb-44 text-center flex flex-col items-center">

          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] rounded-full px-4 py-1.5 mb-6"
          >
            <Sparkles size={13} className="text-marigold" />
            <span className="text-chalk/80 text-xs font-medium tracking-wide">India's #1 Sports Venue Platform</span>
          </motion.div>

          {/* Main headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="font-display text-[40px] sm:text-6xl lg:text-[76px] font-bold tracking-tight leading-[1.05] mb-5"
          >
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-chalk block"
            >
              Precision in
            </motion.span>
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-transparent bg-clip-text bg-gradient-to-r from-marigold via-[#f7c26b] to-marigold block"
            >
              Every Play.
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="font-sans text-base sm:text-lg text-chalk/60 max-w-xl mx-auto font-light leading-relaxed mb-4"
          >
            Book premium sports turfs, elegant banquet halls, and sprawling farmhouses — all in one place.
          </motion.p>

          {/* Trust indicators */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="flex flex-wrap justify-center items-center gap-5 sm:gap-8 mb-2"
          >
            {[
              { icon: Zap, label: 'Instant Booking' },
              { icon: Shield, label: 'Verified Venues' },
              { icon: Star, label: 'Best Prices' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-chalk/45 text-xs font-medium">
                <Icon size={13} className="text-marigold/70" />
                <span>{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ FLOATING SEARCH CARD ═══════════════ */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
        className="relative z-20 w-full max-w-5xl mx-auto px-4 -mt-24 sm:-mt-28"
      >
        <div className="relative group">
          {/* Ambient glow behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-pitch/20 via-marigold/10 to-pitch/20 rounded-[28px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          {/* Card */}
          <div className="relative bg-chalk/95 backdrop-blur-2xl rounded-[24px] shadow-[0_20px_60px_rgba(10,31,20,0.15)] p-3 sm:p-4 flex flex-col md:flex-row gap-2 sm:gap-3 items-stretch border border-ink/[0.06]">

            {/* Location */}
            <div className="flex-1 group/field">
              <div className="h-full px-4 py-3 rounded-2xl bg-mist/60 hover:bg-mist transition-colors cursor-text focus-within:ring-2 focus-within:ring-pitch/15 focus-within:border-pitch/30">
                <label className="flex items-center gap-1.5 mb-1">
                  <MapPin size={12} className="text-pitch" />
                  <span className="font-sans text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-[0.1em]">Location</span>
                </label>
                <input
                  type="text"
                  placeholder="Where are you playing?"
                  value={locationInput}
                  onChange={(e) => onLocationChange(e.target.value)}
                  className="w-full bg-transparent font-sans text-[15px] text-ink focus:outline-none placeholder-ink/30 font-medium"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:flex items-center">
              <div className="w-px h-10 bg-ink/8" />
            </div>

            {/* Date */}
            <div className="flex-1 group/field">
              <div className="h-full px-4 py-3 rounded-2xl bg-mist/60 hover:bg-mist transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-pitch/15 focus-within:border-pitch/30">
                <label className="flex items-center gap-1.5 mb-1">
                  <Calendar size={12} className="text-pitch" />
                  <span className="font-sans text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-[0.1em]">Date</span>
                </label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="w-full bg-transparent font-sans text-[15px] text-ink focus:outline-none font-medium cursor-pointer"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:flex items-center">
              <div className="w-px h-10 bg-ink/8" />
            </div>

            {/* Category */}
            <div className="flex-1 group/field">
              <div className="h-full px-4 py-3 rounded-2xl bg-mist/60 hover:bg-mist transition-colors cursor-pointer relative focus-within:ring-2 focus-within:ring-pitch/15 focus-within:border-pitch/30">
                <label className="flex items-center gap-1.5 mb-1">
                  <Grid3x3 size={12} className="text-pitch" />
                  <span className="font-sans text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-[0.1em]">Category</span>
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full bg-transparent font-sans text-[15px] text-ink focus:outline-none appearance-none cursor-pointer font-medium pr-6"
                >
                  <option value="">All Categories</option>
                  <option value="Turfs">Cricket & Football Turfs</option>
                  <option value="Banquet Halls">Wedding Banquet Halls</option>
                  <option value="Courts">Elite Sports Courts</option>
                  <option value="Farmhouses">Private Lawn Farmhouses</option>
                  <option value="Corporate Hubs">Corporate Summit Spaces</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-5 bottom-4 text-ink/30" />
              </div>
            </div>

            {/* Search Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onSearchSubmit}
              className="group/btn relative w-full md:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-br from-pitch via-pitch to-[#0f4a2e] text-chalk px-7 py-4 md:py-0 rounded-2xl font-sans text-[15px] font-semibold transition-all duration-300 cursor-pointer shrink-0 overflow-hidden shadow-[0_4px_20px_rgba(28,94,63,0.3)] hover:shadow-[0_8px_30px_rgba(28,94,63,0.45)]"
            >
              {/* Button glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-marigold/0 via-marigold/10 to-marigold/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
              <Search size={18} className="relative z-10" />
              <span className="relative z-10">Search</span>
              <ArrowRight size={16} className="relative z-10 opacity-0 -ml-4 group-hover/btn:opacity-100 group-hover/btn:ml-0 transition-all duration-300" />
            </motion.button>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="flex justify-center items-center gap-8 sm:gap-14 mt-8">
          {[
            { value: '500+', label: 'Venues' },
            { value: '10K+', label: 'Bookings' },
            { value: '50+', label: 'Cities' },
          ].map(({ value, label }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className="w-px h-8 bg-ink/8" />}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                className="text-center"
              >
                <div className="font-display text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-pitch to-pitch/70">{value}</div>
                <div className="font-sans text-[11px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.12em] mt-0.5">{label}</div>
              </motion.div>
            </React.Fragment>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
