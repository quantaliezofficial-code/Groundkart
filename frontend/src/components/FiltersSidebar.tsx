import React from 'react';
import { X, Sliders, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FiltersSidebarProps {
  minPrice: string;
  onMinPriceChange: (val: string) => void;
  maxPrice: string;
  onMaxPriceChange: (val: string) => void;
  selectedAmenities: {
    freeParking: boolean;
    floodlights: boolean;
    airConditioning: boolean;
    lockerRooms: boolean;
  };
  onAmenityToggle: (key: 'freeParking' | 'floodlights' | 'airConditioning' | 'lockerRooms') => void;
  selectedCapacity: string;
  onCapacitySet: (capacity: string) => void;
  selectedRating: number;
  onRatingSet: (rating: number) => void;
  onClearAll: () => void;
  resultsCount: number;
  isMobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
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
  onClearAll,
  resultsCount,
  isMobileDrawerOpen,
  onCloseMobileDrawer
}: FiltersSidebarProps) {
  
  const handleClearLocal = (e: React.MouseEvent) => {
    e.preventDefault();
    onClearAll();
  };

  return (
    <>
      {/* ================= DESKTOP FILTER SIDEBAR ================= */}
      <aside className="hidden lg:block w-[280px] shrink-0 sticky top-[95px] h-[calc(100vh-125px)] overflow-y-auto no-scrollbar pb-6">
        <div className="bg-chalk rounded-2xl ring-1 ring-ink/5 p-6 shadow-lg shadow-pitch/5 flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-ink/5">
            <h2 className="font-sans text-lg font-bold text-ink flex items-center gap-2">
              <Sliders size={18} className="text-pitch" />
              <span>Filters</span>
            </h2>
            <motion.button
              onClick={handleClearLocal}
              whileHover={{ color: '#C0492E' }}
              className="text-xs font-medium text-on-surface-variant transition-colors cursor-pointer"
            >
              Clear all
            </motion.button>
          </div>

          {/* Price Range */}
          <section className="flex flex-col gap-4 py-5 border-b border-ink/5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-pitch" />
              <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">Price Range</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-sm">₹</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => onMinPriceChange(e.target.value)}
                  className="w-full bg-mist border-none rounded-xl pl-8 pr-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch/15 transition-all"
                />
              </div>
              <span className="text-on-surface-variant/50 text-sm">-</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-sm">₹</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => onMaxPriceChange(e.target.value)}
                  className="w-full bg-mist border-none rounded-xl pl-8 pr-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch/15 transition-all"
                />
              </div>
            </div>
          </section>

          {/* Amenities Selectors */}
          <section className="flex flex-col gap-4 py-5 border-b border-ink/5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-pitch" />
              <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">Amenities</h3>
            </div>
            <div className="flex flex-col gap-3">
              {(['freeParking', 'floodlights', 'airConditioning', 'lockerRooms'] as const).map((key) => {
                const isChecked = selectedAmenities[key];
                const labels = {
                  freeParking: 'Free Parking',
                  floodlights: 'Floodlights',
                  airConditioning: 'Air Conditioning',
                  lockerRooms: 'Locker Rooms'
                };
                return (
                  <motion.label 
                    key={key}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-3 cursor-pointer group select-none"
                  >
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onAmenityToggle(key)}
                        className="peer appearance-none w-5 h-5 rounded-[6px] bg-mist border-none checked:bg-pitch transition-colors cursor-pointer"
                      />
                      <Check size={12} className={`absolute text-chalk pointer-events-none stroke-[3] transition-opacity duration-200 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                    </div>
                    <span className={`font-sans text-sm transition-colors ${isChecked ? 'text-ink font-medium' : 'text-on-surface-variant group-hover:text-ink'}`}>
                      {labels[key]}
                    </span>
                  </motion.label>
                );
              })}
            </div>
          </section>

          {/* Capacity Targets */}
          <section className="flex flex-col gap-4 py-5 border-b border-ink/5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-pitch" />
              <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">Capacity</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['1-5', '6-10', '11-20', '20+'].map((cap) => (
                <motion.button
                  key={cap}
                  whileTap={{ scale: 0.95 }}
                  layout
                  onClick={() => onCapacitySet(selectedCapacity === cap ? '' : cap)}
                  className={`py-1.5 px-4 rounded-full font-sans text-sm transition-all cursor-pointer ${
                    selectedCapacity === cap
                      ? 'bg-pitch text-chalk font-medium shadow-md shadow-pitch/10'
                      : 'bg-chalk ring-1 ring-ink/10 text-on-surface-variant hover:bg-mist'
                  }`}
                >
                  {cap}
                </motion.button>
              ))}
            </div>
          </section>

          {/* Minimum Rating Selection */}
          <section className="flex flex-col gap-4 pt-5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-pitch" />
              <h3 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">Minimum Rating</h3>
            </div>
            <div className="flex gap-2">
              {[3.0, 4.0, 4.5].map((rate) => (
                <motion.button
                  key={rate}
                  whileTap={{ scale: 0.95 }}
                  layout
                  onClick={() => onRatingSet(selectedRating === rate ? 0 : rate)}
                  className={`flex-1 py-1.5 rounded-full font-sans text-sm flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    selectedRating === rate
                      ? 'bg-marigold/15 text-marigold ring-1 ring-marigold/30 font-semibold'
                      : 'bg-chalk ring-1 ring-ink/10 text-on-surface-variant hover:bg-mist'
                  }`}
                >
                  ★ {rate.toFixed(1)}+
                </motion.button>
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
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-chalk rounded-t-3xl flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Grab handle bar */}
              <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mt-3 mb-2" />
              
              {/* Drawer Header */}
              <div className="px-5 pb-4 flex justify-between items-center border-b border-ink/5">
                <div className="flex items-center gap-2">
                  <Sliders size={20} className="text-pitch" />
                  <h3 className="font-sans text-xl font-bold text-ink">Filters</h3>
                </div>
                <button
                  onClick={onCloseMobileDrawer}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-mist transition-colors cursor-pointer text-on-surface-variant hover:text-ink"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Filtering Options list */}
              <div className="px-5 py-6 overflow-y-auto flex-1 flex flex-col">
                
                {/* Price section */}
                <motion.section 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col gap-4 pb-6 border-b border-ink/5"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-pitch" />
                    <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">Price Range</h4>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-sm">₹</span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={minPrice}
                        onChange={(e) => onMinPriceChange(e.target.value)}
                        className="w-full bg-mist border-none rounded-xl pl-8 pr-3 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch/15 transition-all"
                      />
                    </div>
                    <span className="text-on-surface-variant/50">-</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium text-sm">₹</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={maxPrice}
                        onChange={(e) => onMaxPriceChange(e.target.value)}
                        className="w-full bg-mist border-none rounded-xl pl-8 pr-3 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch/15 transition-all"
                      />
                    </div>
                  </div>
                </motion.section>

                {/* Amenities field */}
                <motion.section 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col gap-4 py-6 border-b border-ink/5"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-pitch" />
                    <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">Amenities</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['freeParking', 'floodlights', 'airConditioning', 'lockerRooms'] as const).map((key) => {
                      const isChecked = selectedAmenities[key];
                      const labels = {
                        freeParking: 'Free Parking',
                        floodlights: 'Floodlights',
                        airConditioning: 'Air Conditioning',
                        lockerRooms: 'Locker Rooms'
                      };
                      return (
                        <motion.button
                          key={key}
                          whileTap={{ scale: 0.95 }}
                          layout
                          onClick={() => onAmenityToggle(key)}
                          className={`py-3 px-4 rounded-xl text-left text-sm transition-all flex items-center gap-3 cursor-pointer ${
                            isChecked
                              ? 'bg-pitch/5 text-pitch font-medium ring-1 ring-pitch/20'
                              : 'bg-mist text-ink hover:bg-mist/80'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-[6px] flex items-center justify-center transition-colors ${
                            isChecked ? 'bg-pitch' : 'bg-chalk ring-1 ring-ink/10'
                          }`}>
                            <Check size={12} className={`text-chalk stroke-[3] transition-opacity ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                          </div>
                          <span>{labels[key]}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.section>

                {/* Capacity group field */}
                <motion.section 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col gap-4 py-6 border-b border-ink/5"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-pitch" />
                    <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">Capacity</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['1-5', '6-10', '11-20', '20+'].map((cap) => (
                      <motion.button
                        key={cap}
                        whileTap={{ scale: 0.95 }}
                        layout
                        onClick={() => onCapacitySet(selectedCapacity === cap ? '' : cap)}
                        className={`px-5 py-2.5 rounded-full font-sans text-sm transition-all cursor-pointer ${
                          selectedCapacity === cap
                            ? 'bg-pitch text-chalk font-medium shadow-md shadow-pitch/10'
                            : 'bg-chalk ring-1 ring-ink/10 text-on-surface-variant hover:bg-mist'
                        }`}
                      >
                        {cap}
                      </motion.button>
                    ))}
                  </div>
                </motion.section>

                {/* Rating selection field */}
                <motion.section 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col gap-4 py-6"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full bg-pitch" />
                    <h4 className="font-sans text-xs uppercase tracking-wider font-bold text-on-surface-variant">Min Rating</h4>
                  </div>
                  <div className="flex gap-2">
                    {[3.0, 4.0, 4.5].map((rate) => (
                      <motion.button
                        key={rate}
                        whileTap={{ scale: 0.95 }}
                        layout
                        onClick={() => onRatingSet(selectedRating === rate ? 0 : rate)}
                        className={`flex-1 py-2.5 rounded-full font-sans text-sm flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          selectedRating === rate
                            ? 'bg-marigold/15 text-marigold ring-1 ring-marigold/30 font-semibold'
                            : 'bg-chalk ring-1 ring-ink/10 text-on-surface-variant hover:bg-mist'
                        }`}
                      >
                        ★ {rate.toFixed(1)}+
                      </motion.button>
                    ))}
                  </div>
                </motion.section>

              </div>

              {/* Bottom active footer action buttons */}
              <div className="px-5 py-4 border-t border-ink/5 bg-chalk flex justify-between items-center gap-4">
                <motion.button
                  onClick={(e: React.MouseEvent) => {
                    handleClearLocal(e);
                    onCloseMobileDrawer();
                  }}
                  whileHover={{ color: '#C0492E' }}
                  className="text-on-surface-variant font-sans text-sm font-medium transition-colors cursor-pointer"
                >
                  Clear all
                </motion.button>
                <motion.button
                  onClick={onCloseMobileDrawer}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 bg-gradient-to-r from-pitch to-[#1a5438] text-chalk font-sans text-sm font-semibold py-3.5 rounded-xl transition-all text-center cursor-pointer shadow-lg shadow-pitch/20"
                >
                  Show {resultsCount} Results
                </motion.button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
