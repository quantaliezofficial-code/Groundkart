import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import GroundSelect from './ui/GroundSelect';
import { MapPin, Calendar, Grid3x3, Search, ArrowRight, ChevronDown } from 'lucide-react';
import { useSmoothScroll } from './SmoothScroll';

interface HeroProps {
  locationInput: string;
  onLocationChange: (val: string) => void;
  dateInput: string;
  onDateChange: (val: string) => void;
  categoryInput: string;
  onCategoryChange: (val: string) => void;
  onSearchSubmit: () => void;
}

const heroSlides = [
  {
    id: "sports",
    label: "SPORTS & FITNESS",
    titleLine1: "Make time",
    titleLine2: "for the game.",
    titleLine2Gold: false,
    description: "Book turfs, courts and sports grounds that fit your next match.",
    cta: "Explore Sports",
    category: "g_sports",
    image: "/hero-sports.webp",
    objectPosition: "65% center", // Adjusted to not block the headline
    contentPosition: "left"
  },
  {
    id: "wedding",
    label: "WEDDINGS & CELEBRATIONS",
    titleLine1: "Make your big day",
    titleLine2: "feel unforgettable.",
    titleLine2Gold: true,
    description: "Discover beautiful halls, lawns and wedding venues for every celebration.",
    cta: "Explore Weddings",
    category: "g_wedding",
    image: "/hero-wedding.webp",
    objectPosition: "70% center",
    contentPosition: "left"
  },
  {
    id: "party",
    label: "PARTIES & SOCIAL EVENTS",
    titleLine1: "Bring everyone",
    titleLine2: "together.",
    titleLine2Gold: false,
    description: "Find the right space for birthdays, parties and nights worth remembering.",
    cta: "Explore Parties",
    category: "g_party",
    image: "/hero-party.webp",
    objectPosition: "60% center",
    contentPosition: "left"
  },
  {
    id: "corporate",
    label: "CORPORATE & BUSINESS",
    titleLine1: "Give your next meeting",
    titleLine2: "the right space.",
    titleLine2Gold: true,
    description: "Book meeting rooms, conference spaces and offsite venues without the hassle.",
    cta: "Explore Business Spaces",
    category: "g_corp",
    image: "/hero-corporate.webp",
    objectPosition: "75% center",
    contentPosition: "left"
  },
  {
    id: "outdoor",
    label: "FARMHOUSES & OUTDOOR",
    titleLine1: "Escape",
    titleLine2: "the ordinary.",
    titleLine2Gold: false,
    description: "Find farmhouses, lawns and private outdoor spaces for gatherings and getaways.",
    cta: "Explore Outdoor Spaces",
    category: "g_outdoor",
    image: "/hero-outdoor.webp",
    objectPosition: "70% center",
    contentPosition: "left"
  },
  {
    id: "resort",
    label: "STAYS, RESORTS & CREATIVE",
    titleLine1: "Find a space that",
    titleLine2: "fits your way of life.",
    titleLine2Gold: true,
    description: "From resorts and villas to studios and creative spaces, discover places made for your plans.",
    cta: "Explore More",
    category: "g_creative",
    image: "/hero-resort.webp",
    objectPosition: "50% center",
    contentPosition: "left"
  }
];

export default function Hero({
  locationInput,
  onLocationChange,
  dateInput,
  onDateChange,
  categoryInput,
  onCategoryChange,
  onSearchSubmit
}: HeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const { scrollTo } = useSmoothScroll();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const currentSlide = heroSlides[currentSlideIndex];

  // Preload next image
  useEffect(() => {
    const nextIndex = (currentSlideIndex + 1) % heroSlides.length;
    const img = new Image();
    img.src = heroSlides[nextIndex].image;
  }, [currentSlideIndex]);

  // Update category based on slide (if not manually overridden)
  useEffect(() => {
    if (!categoryManuallySelected) {
      onCategoryChange(currentSlide.category);
    }
  }, [currentSlideIndex, categoryManuallySelected, onCategoryChange, currentSlide.category]);

  const goToNextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev + 1) % heroSlides.length);
  }, []);

  const goToPrevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, []);

  // Auto rotation
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    
    timerRef.current = setInterval(() => {
      goToNextSlide();
    }, 7000); // 7 seconds

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, goToNextSlide]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevSlide();
      if (e.key === 'ArrowRight') goToNextSlide();
      if (e.key === 'Home') setCurrentSlideIndex(0);
      if (e.key === 'End') setCurrentSlideIndex(heroSlides.length - 1);
    };
    
    // Only listen when the hero is in focus or not interacting with inputs
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
         return; 
      }
      handleKeyDown(e);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [goToNextSlide, goToPrevSlide]);

  // Touch swipe handling
  const touchStartX = useRef<number | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNextSlide();
      else goToPrevSlide();
    }
    touchStartX.current = null;
    setIsPaused(false);
  };

  const handleCategorySelect = (val: string) => {
    setCategoryManuallySelected(true);
    onCategoryChange(val);
  };

  return (
    <div 
      className="relative w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06281D]" 
      tabIndex={0}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-roledescription="carousel"
      aria-label="Venue categories carousel"
    >
      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative w-full min-h-[680px] lg:min-h-[calc(100svh-72px)] flex flex-col justify-center overflow-hidden bg-[#032017]">
        
        {/* Image Slides */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url('${currentSlide.image}')`,
              backgroundPosition: currentSlide.objectPosition
            }}
            aria-hidden="true"
          />
        </AnimatePresence>

        {/* Directional gradient overlays to protect text without losing image richness */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(3, 30, 22, 0.75) 0%, rgba(3, 30, 22, 0.45) 35%, rgba(3, 30, 22, 0.1) 70%, rgba(3, 30, 22, 0.15) 100%)'
          }}
        />
        {/* Subtle bottom protection for search bar */}
        <div 
          className="absolute inset-x-0 bottom-0 h-[320px] lg:h-[220px]"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(3,30,22,0.85) 100%)'
          }}
        />

        {/* ── Content ── */}
        <div className="relative z-10 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 text-left flex flex-col items-start pt-12 pb-[240px] lg:pb-[140px]">
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentSlide.id}
              className={`w-full max-w-[540px] flex flex-col ${currentSlide.contentPosition === 'center' ? 'items-center mx-auto text-center' : currentSlide.contentPosition === 'right' ? 'items-end ml-auto text-right' : 'items-start text-left'}`}
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } },
                visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
              }}
            >
              {/* Category Label */}
              <motion.div 
                variants={{
                  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
                }}
                className="mb-4"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-[#F7F7F2]/90 text-[11px] sm:text-[12px] font-sans tracking-[0.25em] font-medium uppercase">
                    {currentSlide.label}
                  </span>
                  <div className="h-px w-10 bg-[#F7F7F2]/30" />
                </div>
              </motion.div>

              {/* Headline */}
              <motion.h1 
                variants={{
                  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
                }}
                className="font-display text-[42px] sm:text-[54px] lg:text-[70px] font-bold tracking-tight leading-[0.95] mb-5 text-[#F7F7F2] drop-shadow-md"
              >
                <span className="block">{currentSlide.titleLine1}</span>
                <span className={currentSlide.titleLine2Gold ? "block text-[#F4B544]" : "block"}>
                  {currentSlide.titleLine2}
                </span>
              </motion.h1>

              {/* Description */}
              <motion.p 
                variants={{
                  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
                }}
                className="font-sans text-[15px] sm:text-[16px] lg:text-[17px] text-[#F7F7F2]/90 max-w-[480px] font-normal leading-relaxed mb-8 drop-shadow-sm"
              >
                {currentSlide.description}
              </motion.p>

              {/* Primary CTA */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
                }}
              >
                <button
                  onClick={() => {
                    handleCategorySelect(currentSlide.category);
                    onSearchSubmit();
                  }}
                  className="bg-[#F4B544] text-[#06281D] hover:brightness-105 active:scale-[0.98] hover:-translate-y-0.5 px-5 sm:px-6 py-3.5 sm:py-4 rounded-[12px] sm:rounded-[14px] font-sans text-[14px] sm:text-[15px] font-bold transition-all duration-200 cursor-pointer shadow-sm flex items-center gap-2 group"
                >
                  {currentSlide.cta}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </motion.div>

              {/* Slide Progress Indicators */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
                }}
                className="mt-10 sm:mt-12 flex items-center gap-4"
              >
                <div className="font-sans text-[11px] text-[#F7F7F2]/80 font-bold tracking-[0.2em] uppercase">
                  0{currentSlideIndex + 1} / 0{heroSlides.length}
                </div>
                <div className="flex items-center gap-1.5">
                  {heroSlides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      onClick={() => setCurrentSlideIndex(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      aria-current={currentSlideIndex === idx ? "true" : "false"}
                      className="group relative h-4 flex flex-col justify-center cursor-pointer"
                    >
                      <div 
                        className={`h-[2px] transition-all duration-300 rounded-full ${
                          currentSlideIndex === idx ? 'w-8 sm:w-10 bg-[#F4B544]' : 'w-5 sm:w-8 bg-[#F7F7F2]/30 group-hover:bg-[#F7F7F2]/60'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Interactive Smooth Scroll Cue */}
                <button
                  type="button"
                  onClick={() => scrollTo('#trending-section', { offset: -70, duration: 1.4 })}
                  className="hidden md:flex items-center gap-1.5 ml-4 pl-4 border-l border-white/20 text-[#F7F7F2]/70 hover:text-[#F4B544] font-sans text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer group"
                  aria-label="Scroll to trending venues"
                >
                  <span>Explore below</span>
                  <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform duration-200" />
                </button>
              </motion.div>
            </motion.div>
          </AnimatePresence>
          
        </div>

        {/* ═══════════════ FLOATING SEARCH CARD (ABSOLUTE BOTTOM) ═══════════════ */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="absolute bottom-6 sm:bottom-8 lg:bottom-10 left-0 right-0 z-20 w-full max-w-[840px] mx-auto px-4"
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
        >
          {/* Card */}
          <div className="bg-[#F7F7F2] rounded-[16px] sm:rounded-[20px] shadow-[0_4px_24px_rgb(0,0,0,0.06)] px-2 sm:px-3 py-2 flex flex-col md:flex-row gap-0.5 items-stretch border border-[#06281D]/5 min-h-[110px] sm:min-h-[120px] md:min-h-0 md:h-[115px]">

            {/* Location */}
            <div className="flex-1 md:flex items-center relative">
              <div className="w-full h-full px-4 py-3 md:py-0 flex flex-col justify-center rounded-[12px] hover:bg-black/[0.03] transition-colors cursor-text focus-within:ring-2 focus-within:ring-[#06281D]/15 focus-within:bg-white ease-out">
                <label htmlFor="hero-location" className="flex items-center gap-1.5 mb-1 sm:mb-1.5 cursor-pointer">
                  <MapPin size={13} className="text-[#06281D]/60" />
                  <span className="font-sans text-[11px] font-bold text-[#06281D]/70 uppercase tracking-widest">Location</span>
                </label>
                <input
                  id="hero-location"
                  type="text"
                  placeholder="Where are you looking?"
                  value={locationInput}
                  onChange={(e) => onLocationChange(e.target.value)}
                  className="w-full bg-transparent font-sans text-[14px] sm:text-[15px] text-[#06281D] focus:outline-none placeholder-[#06281D]/40 font-semibold truncate"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:flex items-center">
              <div className="w-px h-12 bg-[#06281D]/10" />
            </div>

            {/* Date */}
            <div className="flex-1 md:flex items-center relative">
              <div className="w-full h-full px-4 py-3 md:py-0 flex flex-col justify-center rounded-[12px] hover:bg-black/[0.03] transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-[#06281D]/15 focus-within:bg-white ease-out">
                <label htmlFor="hero-date" className="flex items-center gap-1.5 mb-1 sm:mb-1.5 cursor-pointer">
                  <Calendar size={13} className="text-[#06281D]/60" />
                  <span className="font-sans text-[11px] font-bold text-[#06281D]/70 uppercase tracking-widest">Date</span>
                </label>
                <input
                  id="hero-date"
                  type="date"
                  value={dateInput}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="w-full bg-transparent font-sans text-[14px] sm:text-[15px] text-[#06281D] focus:outline-none font-semibold cursor-pointer"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="hidden md:flex items-center">
              <div className="w-px h-12 bg-[#06281D]/10" />
            </div>

            {/* Category */}
            <div className="flex-[1.2] md:flex items-center relative">
              <div className="w-full h-full">
                <GroundSelect
                  label="What are you planning?"
                  labelIcon={<Grid3x3 size={13} className="text-[#06281D]/60" />}
                  value={categoryInput}
                  onValueChange={handleCategorySelect}
                  placeholder="Venue / Occasion"
                  options={[
                    { value: "g_sports", label: "Sports & Fitness", isGroupHeader: true },
                    { value: "football", label: "Football Turf" },
                    { value: "cricket", label: "Cricket Ground" },
                    { value: "badminton", label: "Badminton Court" },
                    { value: "tennis", label: "Tennis Court" },
                    { value: "swimming", label: "Swimming Pool" },
                    { value: "g_party", label: "Parties & Celebrations", isGroupHeader: true },
                    { value: "party_hall", label: "Party Hall" },
                    { value: "birthday", label: "Birthday Venue" },
                    { value: "lounge", label: "Lounge" },
                    { value: "g_wedding", label: "Weddings & Events", isGroupHeader: true },
                    { value: "banquet", label: "Banquet Hall" },
                    { value: "wedding_lawn", label: "Wedding Lawn" },
                    { value: "reception", label: "Reception Venue" },
                    { value: "g_corp", label: "Corporate & Business", isGroupHeader: true },
                    { value: "meeting_room", label: "Meeting Room" },
                    { value: "conference", label: "Conference Room" },
                    { value: "coworking", label: "Coworking Space" },
                    { value: "g_outdoor", label: "Outdoor & Leisure", isGroupHeader: true },
                    { value: "farmhouse", label: "Farmhouse" },
                    { value: "resort", label: "Resort" },
                    { value: "g_creative", label: "Creative & Studios", isGroupHeader: true },
                    { value: "photography", label: "Photography Studio" },
                    { value: "dance_studio", label: "Dance Studio" }
                  ]}
                  className="w-full h-full flex flex-col justify-center rounded-[12px] transition-colors focus-within:ring-2 focus-within:ring-[#06281D]/15 focus-within:bg-white hover:bg-black/[0.03]"
                />
              </div>
            </div>

            {/* Search Button */}
            <div className="flex items-center md:pl-2 mt-2 md:mt-0 p-1 md:p-0 shrink-0">
              <button
                onClick={onSearchSubmit}
                className="w-full md:w-[150px] lg:w-[160px] flex items-center justify-center gap-2 bg-[#06281D] hover:bg-[#0B3D2E] text-[#F7F7F2] h-[60px] md:h-full md:max-h-[66px] rounded-[12px] md:rounded-[14px] font-sans text-[15px] font-bold transition-all active:scale-[0.98] cursor-pointer shadow-md"
              >
                <Search size={16} />
                <span>Search</span>
              </button>
            </div>
          </div>
        </motion.div>

      </section>
    </div>
  );
}
