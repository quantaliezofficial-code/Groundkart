import React, { useState, useMemo } from 'react';
import {
  X,
  Sliders,
  Check,
  Star,
  Car,
  SunMedium,
  Wind,
  DoorOpen,
  Wifi,
  Zap,
  Droplets,
  Volume2,
  Utensils,
  Accessibility,
  Shield,
  Tv,
  Waves,
  HeartPulse,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Compass,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VenueSortOption } from '../types';

export interface AmenityFilterItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  keywords: string[];
}

export const AMENITY_FILTER_ITEMS: AmenityFilterItem[] = [
  {
    id: 'freeParking',
    label: 'Free Parking',
    icon: Car,
    keywords: ['park', 'valet'],
  },
  {
    id: 'floodlights',
    label: 'Floodlights',
    icon: SunMedium,
    keywords: ['light', 'stadium lighting', 'floodlight'],
  },
  {
    id: 'airConditioning',
    label: 'Air Conditioning',
    icon: Wind,
    keywords: ['ac', 'air', 'climate', 'cooler'],
  },
  {
    id: 'lockerRooms',
    label: 'Locker Rooms',
    icon: DoorOpen,
    keywords: ['room', 'bath', 'locker', 'changing', 'shower'],
  },
  {
    id: 'wifi',
    label: 'High-Speed Wi-Fi',
    icon: Wifi,
    keywords: ['wifi', 'wi-fi', 'internet'],
  },
  {
    id: 'powerBackup',
    label: 'Power Backup',
    icon: Zap,
    keywords: ['power', 'backup', 'generator'],
  },
  {
    id: 'restrooms',
    label: 'Washrooms & Water',
    icon: Droplets,
    keywords: ['washroom', 'restroom', 'water', 'toilet'],
  },
  {
    id: 'soundSystem',
    label: 'Sound & Audio',
    icon: Volume2,
    keywords: ['sound', 'audio', 'speaker', 'mic', 'dj'],
  },
  {
    id: 'catering',
    label: 'Catering Setup',
    icon: Utensils,
    keywords: ['cater', 'kitchen', 'pantry', 'cafe', 'canteen'],
  },
  {
    id: 'wheelchair',
    label: 'Wheelchair Access',
    icon: Accessibility,
    keywords: ['wheelchair', 'accessible', 'elevator', 'lift'],
  },
  {
    id: 'security',
    label: 'CCTV & Security',
    icon: Shield,
    keywords: ['cctv', 'security', 'guard', 'surveillance'],
  },
  {
    id: 'projector',
    label: 'Projector / Screen',
    icon: Tv,
    keywords: ['projector', 'screen', 'display', 'wall'],
  },
  {
    id: 'swimmingPool',
    label: 'Swimming Pool',
    icon: Waves,
    keywords: ['pool', 'swimming'],
  },
  {
    id: 'firstAid',
    label: 'First Aid Kit',
    icon: HeartPulse,
    keywords: ['first aid', 'medical', 'fire'],
  },
];

export const CATEGORY_OPTIONS = [
  { id: '', label: 'All Categories' },
  { id: 'sports', label: 'Sports Grounds' },
  { id: 'banquet_hall', label: 'Banquet Halls' },
  { id: 'farmhouse', label: 'Farmhouses' },
  { id: 'corporate', label: 'Corporate Spaces' },
  { id: 'community_hall', label: 'Community Halls' },
];

export const ENVIRONMENT_OPTIONS = [
  { id: '', label: 'Any Setting' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'indoor', label: 'Indoor' },
  { id: 'covered', label: 'Covered' },
];

export const PRICE_PRESETS = [
  { label: 'Under ₹1,000', min: '', max: '1000' },
  { label: '₹1,000–₹2,500', min: '1000', max: '2500' },
  { label: '₹2,500–₹5,000', min: '2500', max: '5000' },
  { label: '₹5,000+', min: '5000', max: '' },
];

export const SORT_OPTIONS: { id: VenueSortOption; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'newest', label: 'Newest Venues' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'rating_desc', label: 'Highest Rated' },
];

export function matchesAmenity(venueAmenities: string[] = [], amenityId: string): boolean {
  if (!venueAmenities || venueAmenities.length === 0) return false;
  const item = AMENITY_FILTER_ITEMS.find((a) => a.id === amenityId);
  if (!item) return false;
  const lowerVenAms = venueAmenities.map((a) => a.toLowerCase());
  return item.keywords.some((kw) => lowerVenAms.some((va) => va.includes(kw)));
}

export interface FiltersSidebarProps {
  minPrice: string;
  onMinPriceChange: (val: string) => void;
  maxPrice: string;
  onMaxPriceChange: (val: string) => void;
  selectedAmenities: string[] | Record<string, boolean>;
  onAmenityToggle: (key: any) => void;
  selectedCapacity: string;
  onCapacitySet: (capacity: string) => void;
  selectedRating: number;
  onRatingSet: (rating: number) => void;
  selectedCategory?: string;
  onCategorySet?: (category: string) => void;
  selectedEnvironment?: string;
  onEnvironmentSet?: (env: string) => void;
  sortBy?: VenueSortOption;
  onSortByChange?: (sort: VenueSortOption) => void;
  onClearAll: () => void;
  resultsCount: number;
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
  amenityCounts?: Record<string, number>;
}

export default function FiltersSidebar({
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  selectedAmenities,
  onAmenityToggle,
  selectedCapacity,
  onCapacitySet,
  selectedRating,
  onRatingSet,
  selectedCategory = '',
  onCategorySet,
  selectedEnvironment = '',
  onEnvironmentSet,
  sortBy = 'recommended',
  onSortByChange,
  onClearAll,
  resultsCount,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  amenityCounts = {},
}: FiltersSidebarProps) {
  const [showAllAmenities, setShowAllAmenities] = useState(false);

  // Normalize selected amenities whether passed as string[] or Record<string, boolean>
  const activeAmenitiesList: string[] = useMemo(() => {
    if (Array.isArray(selectedAmenities)) return selectedAmenities;
    if (typeof selectedAmenities === 'object' && selectedAmenities !== null) {
      return Object.entries(selectedAmenities)
        .filter(([_, v]) => Boolean(v))
        .map(([k]) => k);
    }
    return [];
  }, [selectedAmenities]);

  const isAmenityChecked = (id: string) => activeAmenitiesList.includes(id);

  // Total active filters count
  const activeFiltersCount = useMemo(() => {
    let count = activeAmenitiesList.length;
    if (minPrice || maxPrice) count += 1;
    if (selectedCapacity) count += 1;
    if (selectedRating > 0) count += 1;
    if (selectedCategory) count += 1;
    if (selectedEnvironment) count += 1;
    return count;
  }, [
    activeAmenitiesList.length,
    minPrice,
    maxPrice,
    selectedCapacity,
    selectedRating,
    selectedCategory,
    selectedEnvironment,
  ]);

  const visibleAmenities = showAllAmenities
    ? AMENITY_FILTER_ITEMS
    : AMENITY_FILTER_ITEMS.slice(0, 6);

  const handleClearLocal = (e: React.MouseEvent) => {
    e.preventDefault();
    onClearAll();
  };

  const applyPricePreset = (min: string, max: string) => {
    if (minPrice === min && maxPrice === max) {
      onMinPriceChange('');
      onMaxPriceChange('');
    } else {
      onMinPriceChange(min);
      onMaxPriceChange(max);
    }
  };

  return (
    <>
      {/* ================= DESKTOP FILTER SIDEBAR ================= */}
      <aside
        className="hidden lg:block w-[300px] shrink-0 sticky top-[95px] h-[calc(100vh-125px)] overflow-y-auto no-scrollbar pb-6"
        data-lenis-prevent
      >
        <div className="bg-chalk rounded-2xl ring-1 ring-ink/5 p-6 shadow-lg shadow-pitch/5 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-ink/5">
            <h2 className="font-sans text-lg font-bold text-ink flex items-center gap-2">
              <Sliders size={18} className="text-pitch" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pitch/10 text-pitch">
                  {activeFiltersCount}
                </span>
              )}
            </h2>
            <button
              onClick={handleClearLocal}
              disabled={activeFiltersCount === 0}
              className={`text-xs font-semibold transition-colors cursor-pointer ease-out ${
                activeFiltersCount > 0
                  ? 'text-clay hover:text-red-700'
                  : 'text-on-surface-variant/40 cursor-default'
              }`}
            >
              Clear all
            </button>
          </div>

          {/* Category Filter (if handler provided) */}
          {onCategorySet && (
            <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3.5 rounded-full bg-pitch" />
                <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                  Category
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id || 'all'}
                      type="button"
                      onClick={() => onCategorySet(cat.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-sans transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-pitch text-chalk font-semibold shadow-xs'
                          : 'bg-mist text-ink hover:bg-ink/5'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Price Range */}
          <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3.5 rounded-full bg-pitch" />
                <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                  Price Range
                </h3>
              </div>
              {(minPrice || maxPrice) && (
                <button
                  type="button"
                  onClick={() => {
                    onMinPriceChange('');
                    onMaxPriceChange('');
                  }}
                  className="text-[11px] text-on-surface-variant hover:text-clay"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Quick Price Presets */}
            <div className="grid grid-cols-2 gap-1.5 mb-1">
              {PRICE_PRESETS.map((preset) => {
                const isActive = minPrice === preset.min && maxPrice === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPricePreset(preset.min, preset.max)}
                    className={`text-[11px] py-1 px-2 rounded-md font-sans transition-all text-center cursor-pointer ${
                      isActive
                        ? 'bg-pitch/10 text-pitch font-semibold ring-1 ring-pitch/20'
                        : 'bg-mist/70 text-on-surface-variant hover:bg-mist'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => onMinPriceChange(e.target.value)}
                  className="w-full bg-mist border-none rounded-xl pl-7 pr-2.5 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-pitch/15 transition ease-out"
                />
              </div>
              <span className="text-on-surface-variant/50 text-xs font-semibold">-</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => onMaxPriceChange(e.target.value)}
                  className="w-full bg-mist border-none rounded-xl pl-7 pr-2.5 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-pitch/15 transition ease-out"
                />
              </div>
            </div>
          </section>

          {/* Comprehensive Amenities Selectors */}
          <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3.5 rounded-full bg-pitch" />
                <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                  Amenities
                </h3>
              </div>
              {activeAmenitiesList.length > 0 && (
                <span className="text-[11px] font-bold text-pitch">
                  {activeAmenitiesList.length} selected
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {visibleAmenities.map((item) => {
                const isChecked = isAmenityChecked(item.id);
                const count = amenityCounts[item.id];
                const IconComp = item.icon;
                return (
                  <label
                    key={item.id}
                    className="flex items-center justify-between py-1 px-1 rounded-lg hover:bg-mist/60 cursor-pointer group select-none transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative flex items-center justify-center w-4.5 h-4.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onAmenityToggle(item.id)}
                          className="peer appearance-none w-4.5 h-4.5 rounded-[5px] bg-mist border border-ink/10 checked:bg-pitch checked:border-pitch transition-colors cursor-pointer ease-out"
                        />
                        <Check
                          size={11}
                          className={`absolute text-chalk pointer-events-none stroke-[3] transition-opacity duration-150 ${
                            isChecked ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      </div>
                      <IconComp
                        size={14}
                        className={`shrink-0 transition-colors ${
                          isChecked ? 'text-pitch' : 'text-on-surface-variant/70 group-hover:text-ink'
                        }`}
                      />
                      <span
                        className={`font-sans text-xs truncate transition-colors ${
                          isChecked
                            ? 'text-ink font-semibold'
                            : 'text-on-surface-variant group-hover:text-ink'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>

                    {typeof count === 'number' && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                          isChecked ? 'bg-pitch/10 text-pitch' : 'text-on-surface-variant/50'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Show more/less amenities toggle */}
            <button
              type="button"
              onClick={() => setShowAllAmenities(!showAllAmenities)}
              className="flex items-center justify-center gap-1.5 py-1.5 mt-1 text-xs font-semibold text-pitch hover:bg-pitch/5 rounded-lg transition-colors cursor-pointer"
            >
              <span>
                {showAllAmenities
                  ? 'Show fewer amenities'
                  : `+${AMENITY_FILTER_ITEMS.length - 6} more amenities`}
              </span>
              {showAllAmenities ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </section>

          {/* Environment / Venue Setting */}
          {onEnvironmentSet && (
            <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3.5 rounded-full bg-pitch" />
                <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                  Setting
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ENVIRONMENT_OPTIONS.map((env) => {
                  const isSelected = selectedEnvironment === env.id;
                  return (
                    <button
                      key={env.id || 'any'}
                      type="button"
                      onClick={() => onEnvironmentSet(env.id)}
                      className={`text-xs py-1.5 px-2.5 rounded-lg font-sans transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-pitch text-chalk font-semibold shadow-xs'
                          : 'bg-mist text-ink hover:bg-ink/5'
                      }`}
                    >
                      {env.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Capacity Targets */}
          <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3.5 rounded-full bg-pitch" />
              <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                Capacity
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {['1-5', '6-10', '11-20', '20+'].map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => onCapacitySet(selectedCapacity === cap ? '' : cap)}
                  className={`py-1.5 px-3 rounded-lg font-sans text-xs transition cursor-pointer text-center ${
                    selectedCapacity === cap
                      ? 'bg-pitch text-chalk font-semibold shadow-xs'
                      : 'bg-chalk ring-1 ring-ink/10 text-on-surface-variant hover:bg-mist'
                  } ease-out`}
                >
                  {cap} Guests
                </button>
              ))}
            </div>
          </section>

          {/* Minimum Rating Selection */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3.5 rounded-full bg-pitch" />
              <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                Minimum Rating
              </h3>
            </div>
            <div className="flex gap-1.5">
              {[3.0, 4.0, 4.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onRatingSet(selectedRating === rate ? 0 : rate)}
                  className={`flex-1 py-1.5 rounded-lg font-sans text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                    selectedRating === rate
                      ? 'bg-marigold/15 text-marigold ring-1 ring-marigold/30 font-bold'
                      : 'bg-chalk ring-1 ring-ink/10 text-on-surface-variant hover:bg-mist'
                  } ease-out`}
                >
                  <Star size={12} className="inline fill-marigold text-marigold" />
                  <span>{rate.toFixed(1)}+</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* ================= MOBILE BOTTOM SHEET FILTERS DRAWER ================= */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop Shadow Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobileDrawer}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />

            {/* Bottom Drawer Container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.1}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100) onCloseMobileDrawer();
              }}
              className="absolute bottom-0 left-0 right-0 max-h-[88vh] bg-chalk rounded-t-3xl flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Grab handle bar */}
              <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mt-3 mb-2" />

              {/* Drawer Header */}
              <div className="px-5 pb-3 flex justify-between items-center border-b border-ink/5">
                <div className="flex items-center gap-2">
                  <Sliders size={20} className="text-pitch" />
                  <h3 className="font-sans text-lg font-bold text-ink">Filters & Sorting</h3>
                  {activeFiltersCount > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-pitch/10 text-pitch">
                      {activeFiltersCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={onCloseMobileDrawer}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-mist transition-colors cursor-pointer text-on-surface-variant hover:text-ink ease-out"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Filtering Options list */}
              <div className="px-5 py-4 overflow-y-auto flex-1 flex flex-col gap-6" data-lenis-prevent>
                {/* Mobile Sort Options */}
                {onSortByChange && (
                  <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown size={15} className="text-pitch" />
                      <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Sort Venues
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {SORT_OPTIONS.map((opt) => {
                        const isSelected = sortBy === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onSortByChange(opt.id)}
                            className={`py-2 px-3 rounded-xl text-xs font-medium text-left transition ${
                              isSelected
                                ? 'bg-pitch text-chalk font-semibold shadow-xs'
                                : 'bg-mist text-ink hover:bg-mist/80'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Category Options */}
                {onCategorySet && (
                  <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3.5 rounded-full bg-pitch" />
                      <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Space Category
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORY_OPTIONS.map((cat) => {
                        const isSelected = selectedCategory === cat.id;
                        return (
                          <button
                            key={cat.id || 'all'}
                            type="button"
                            onClick={() => onCategorySet(cat.id)}
                            className={`py-2 px-3 rounded-xl text-xs font-medium text-left transition ${
                              isSelected
                                ? 'bg-pitch text-chalk font-semibold'
                                : 'bg-mist text-ink'
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Price section */}
                <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3.5 rounded-full bg-pitch" />
                      <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Price Range
                      </h4>
                    </div>
                    {(minPrice || maxPrice) && (
                      <button
                        type="button"
                        onClick={() => {
                          onMinPriceChange('');
                          onMaxPriceChange('');
                        }}
                        className="text-xs text-clay font-semibold"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-1">
                    {PRICE_PRESETS.map((preset) => {
                      const isActive = minPrice === preset.min && maxPrice === preset.max;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyPricePreset(preset.min, preset.max)}
                          className={`text-xs py-1.5 px-3 rounded-lg text-center font-medium ${
                            isActive
                              ? 'bg-pitch/10 text-pitch font-semibold ring-1 ring-pitch/30'
                              : 'bg-mist text-on-surface-variant'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-sm">
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={minPrice}
                        onChange={(e) => onMinPriceChange(e.target.value)}
                        className="w-full bg-mist border-none rounded-xl pl-8 pr-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch/15 transition ease-out"
                      />
                    </div>
                    <span className="text-on-surface-variant/50">-</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-sm">
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={maxPrice}
                        onChange={(e) => onMaxPriceChange(e.target.value)}
                        className="w-full bg-mist border-none rounded-xl pl-8 pr-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch/15 transition ease-out"
                      />
                    </div>
                  </div>
                </section>

                {/* Amenities grid */}
                <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3.5 rounded-full bg-pitch" />
                      <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Amenities
                      </h4>
                    </div>
                    {activeAmenitiesList.length > 0 && (
                      <span className="text-xs font-semibold text-pitch">
                        {activeAmenitiesList.length} selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {AMENITY_FILTER_ITEMS.map((item) => {
                      const isChecked = isAmenityChecked(item.id);
                      const count = amenityCounts[item.id];
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onAmenityToggle(item.id)}
                          className={`py-2 px-3 rounded-xl text-left text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                            isChecked
                              ? 'bg-pitch/10 text-pitch font-semibold ring-1 ring-pitch/30'
                              : 'bg-mist text-ink hover:bg-mist/80'
                          } ease-out`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <IconComp size={14} className="shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {typeof count === 'number' && (
                            <span className="text-[10px] text-on-surface-variant/60 shrink-0">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Setting / Environment */}
                {onEnvironmentSet && (
                  <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3.5 rounded-full bg-pitch" />
                      <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                        Setting / Environment
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {ENVIRONMENT_OPTIONS.map((env) => {
                        const isSelected = selectedEnvironment === env.id;
                        return (
                          <button
                            key={env.id || 'any'}
                            type="button"
                            onClick={() => onEnvironmentSet(env.id)}
                            className={`py-2 px-3 rounded-xl text-xs font-medium transition ${
                              isSelected
                                ? 'bg-pitch text-chalk font-semibold'
                                : 'bg-mist text-ink'
                            }`}
                          >
                            {env.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Capacity group field */}
                <section className="flex flex-col gap-3 pb-4 border-b border-ink/5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 rounded-full bg-pitch" />
                    <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                      Capacity
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['1-5', '6-10', '11-20', '20+'].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => onCapacitySet(selectedCapacity === cap ? '' : cap)}
                        className={`py-2 px-3 rounded-xl font-sans text-xs transition cursor-pointer text-center ${
                          selectedCapacity === cap
                            ? 'bg-pitch text-chalk font-semibold shadow-xs'
                            : 'bg-chalk ring-1 ring-ink/10 text-on-surface-variant'
                        } ease-out`}
                      >
                        {cap} Guests
                      </button>
                    ))}
                  </div>
                </section>

                {/* Rating selection field */}
                <section className="flex flex-col gap-3 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 rounded-full bg-pitch" />
                    <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                      Min Rating
                    </h4>
                  </div>
                  <div className="flex gap-2">
                    {[3.0, 4.0, 4.5].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => onRatingSet(selectedRating === rate ? 0 : rate)}
                        className={`flex-1 py-2 rounded-xl font-sans text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                          selectedRating === rate
                            ? 'bg-marigold/15 text-marigold ring-1 ring-marigold/30 font-bold'
                            : 'bg-chalk ring-1 ring-ink/10 text-on-surface-variant'
                        } ease-out`}
                      >
                        <Star size={13} className="inline fill-marigold text-marigold" />
                        <span>{rate.toFixed(1)}+</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Bottom active footer action buttons */}
              <div className="px-5 py-3 border-t border-ink/5 bg-chalk flex justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    handleClearLocal(e);
                    onCloseMobileDrawer();
                  }}
                  className="text-on-surface-variant font-sans text-xs font-semibold py-2 px-3 hover:text-clay transition-colors cursor-pointer"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={onCloseMobileDrawer}
                  className="flex-1 bg-gradient-to-r from-pitch to-[#1a5438] text-chalk font-sans text-xs font-bold py-3 rounded-xl transition text-center cursor-pointer shadow-md shadow-pitch/20 ease-out"
                >
                  Show {resultsCount} {resultsCount === 1 ? 'Venue' : 'Venues'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
