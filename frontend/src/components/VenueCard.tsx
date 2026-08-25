import React from 'react';
import { Star, MapPin, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Venue } from '../types';

interface VenueCardProps {
  key?: React.Key;
  venue: Venue;
  onClick: (venueId: string) => void;
  onToggleFavorite: (venueId: string, e: React.MouseEvent) => void;
  isFavorite: boolean;
}

export default function VenueCard({
  venue,
  onClick,
  onToggleFavorite,
  isFavorite
}: VenueCardProps) {
  return (
    <motion.div
      onClick={() => onClick(venue.id)}
      whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(28,94,63,0.12)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`bg-chalk rounded-2xl ring-1 ring-ink/5 overflow-hidden flex flex-col shadow-lg transition-colors cursor-pointer group select-none ${
        venue.isFullyBookedToday ? 'opacity-85' : ''
      }`}
    >
      {/* Venue Media Crop (4:3) */}
      <div className="relative aspect-[4/3] w-full bg-surface-container-high overflow-hidden rounded-t-2xl">
        <img
          src={venue.image}
          alt={venue.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Gradient Overlay at Bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/60 to-transparent pointer-events-none" />

        {/* Floating Heart Button */}
        <motion.button
          onClick={(e) => onToggleFavorite(venue.id, e)}
          whileTap={{ scale: 1.3 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-chalk/80 hover:bg-chalk backdrop-blur-sm flex items-center justify-center text-on-surface-variant hover:text-clay transition-colors hover:scale-110 z-10 shadow-sm"
          aria-label="Add to favorites"
        >
          <Heart
            size={18}
            className={`transition-colors duration-150 ${
              isFavorite ? 'fill-clay text-clay' : 'text-on-surface-variant'
            }`}
          />
        </motion.button>

        {/* Glassmorphic Rating Floating Chip */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute top-3 right-3 bg-ink/60 backdrop-blur-md text-chalk px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm"
        >
          <Star size={12} className="fill-marigold text-marigold" />
          <span className="font-sans text-xs font-bold text-chalk">{venue.rating.toFixed(1)}</span>
        </motion.div>

        {/* fully booked watermark overlay */}
        {venue.isFullyBookedToday && (
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-20">
            <span className="bg-chalk/80 backdrop-blur-lg text-pitch text-xs font-bold px-4 py-2 rounded-full shadow-2xl tracking-widest border border-chalk">
              FULLY BOOKED TODAY
            </span>
          </div>
        )}

        {/* fast fill tag */}
        {!venue.isFullyBookedToday && venue.isFastFill && (
          <div className="absolute bottom-3 left-3 bg-gradient-to-r from-marigold to-[#e5952e] text-pitch text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded shadow-sm z-10">
            FAST FILL
          </div>
        )}
      </div>

      {/* Content description */}
      <div className="p-4 flex flex-col flex-grow bg-chalk">
        <div className="flex justify-between items-start gap-1 mb-1">
          <h3 className="font-sans text-base font-semibold text-ink line-clamp-1 group-hover:text-pitch transition-colors">
            {venue.name}
          </h3>
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-sans text-base font-bold text-pitch shrink-0"
          >
            {venue.currency || '₹'}{venue.pricePerHour}
            <span className="text-sm font-normal text-on-surface-variant">
              /{venue.unitType === 'hour' ? 'hr' : venue.unitType === 'half_day' ? 'half-day' : 'day'}
            </span>
          </motion.span>
        </div>

        {/* physical location details */}
        <p className="font-sans text-xs text-on-surface-variant mb-3 flex items-center gap-1">
          <MapPin size={12} className="text-pitch/70" />
          <span>
            {venue.district}
            {venue.distanceKm && ` • ${venue.distanceKm}km away`}
          </span>
        </p>

        {/* tag values & sub categories */}
        <div className="mt-auto pt-3 border-t border-ink/5 flex justify-between items-center">
          <div className="flex gap-1.5">
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="px-2.5 py-0.5 bg-mist text-ink rounded-full text-xs font-medium"
            >
              {venue.sportType}
            </motion.span>
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="px-2.5 py-0.5 bg-mist text-ink rounded-full text-xs font-medium"
            >
              {venue.capacityGroup} Cap
            </motion.span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
