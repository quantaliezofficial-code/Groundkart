import React from 'react';
import { motion } from 'framer-motion';
import GroundSelect from './ui/GroundSelect';
import { MapPin, Calendar, Grid3x3, Search, ChevronDown, ArrowRight } from 'lucide-react';

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

  return (
    <div className="relative w-full">
      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative w-full min-h-[85vh] flex flex-col justify-center overflow-hidden pt-24 pb-12">

        {/* ── Background layers ── */}
        <div className="absolute inset-0 bg-pitch" />

        {/* Static Hero image without Ken Burns */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
          style={{
            backgroundImage: "url('/stadium-bg.png')",
          }}
        />

        {/* Clean, subtle gradient overlays for depth and readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-pitch via-pitch/40 to-transparent opacity-95" />
        <div className="absolute inset-0 bg-gradient-to-b from-pitch/90 via-transparent to-pitch/50 opacity-90" />

        {/* ── Content ── */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 sm:pb-24 text-center flex flex-col items-center">

          {/* Main headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-[48px] sm:text-[64px] lg:text-[80px] font-bold tracking-tight leading-[1.05] mb-6 drop-shadow-lg"
          >
            <span className="text-chalk block text-[40px] sm:text-[56px] lg:text-[72px]">
              Find the right
            </span>
            <span className="text-marigold block mt-1 text-[40px] sm:text-[56px] lg:text-[72px]">
              space for every occasion.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="font-sans text-base sm:text-lg text-chalk/80 max-w-xl mx-auto font-light leading-relaxed mb-4 drop-shadow-sm"
          >
            Discover and book sports grounds, party venues, wedding spaces, corporate rooms, farmhouses and more — all in one place.
          </motion.p>
        </div>
      </section>

      {/* ═══════════════ FLOATING SEARCH CARD ═══════════════ */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="relative z-20 w-full max-w-5xl mx-auto px-4 -mt-20 sm:-mt-24 mb-16"
      >
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-[20px] shadow-lg p-3 sm:p-4 flex flex-col md:flex-row gap-2 sm:gap-3 items-stretch border border-ink/5">

          {/* Location */}
          <div className="flex-1">
            <div className="h-full px-4 py-3 rounded-xl bg-mist/50 hover:bg-mist transition-colors cursor-text focus-within:ring-2 focus-within:ring-pitch/20 focus-within:bg-white ease-out">
              <label className="flex items-center gap-1.5 mb-1.5">
                <MapPin size={14} className="text-pitch/70" />
                <span className="font-sans text-[11px] font-semibold text-pitch/80 uppercase tracking-wide">Location</span>
              </label>
              <input
                type="text"
                placeholder="Where are you looking?"
                value={locationInput}
                onChange={(e) => onLocationChange(e.target.value)}
                className="w-full bg-transparent font-sans text-[15px] text-ink focus:outline-none placeholder-ink/40 font-medium"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:flex items-center">
            <div className="w-px h-10 bg-ink/10" />
          </div>

          {/* Date */}
          <div className="flex-1">
            <div className="h-full px-4 py-3 rounded-xl bg-mist/50 hover:bg-mist transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-pitch/20 focus-within:bg-white ease-out">
              <label className="flex items-center gap-1.5 mb-1.5">
                <Calendar size={14} className="text-pitch/70" />
                <span className="font-sans text-[11px] font-semibold text-pitch/80 uppercase tracking-wide">Date</span>
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
            <div className="w-px h-10 bg-ink/10" />
          </div>

          {/* Category */}
          <div className="flex-1">
            <GroundSelect
              label="What are you planning?"
              labelIcon={<Grid3x3 size={14} className="text-pitch/70" />}
              value={categoryInput}
              onValueChange={onCategoryChange}
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
              className="h-full"
            />
          </div>

          {/* Search Button */}
          <button
            onClick={onSearchSubmit}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-pitch hover:bg-[#083023] text-chalk px-8 py-4 md:py-0 rounded-xl font-sans text-[15px] font-semibold transition-colors cursor-pointer shrink-0"
          >
            <Search size={18} />
            <span>Search</span>
          </button>
        </div>
      </motion.section>
    </div>
  );
}
