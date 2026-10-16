import React, { useState, useEffect } from 'react';
import { ListingFormData } from './ListingBuilder';
import { Smartphone, Monitor, MapPin, Users, Maximize, Sparkles, Star, CheckCircle, Shield, Building2 } from 'lucide-react';
import { ownerApi } from '../../../lib/api/owner';
import { VenueImage } from '../../../lib/api/types';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

export default function PreviewStep({ data, update, venueId }: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [mediaList, setMediaList] = useState<VenueImage[]>([]);

  useEffect(() => {
    if (!venueId) return;
    ownerApi.getVenue(venueId).then((v) => {
      setMediaList(v.media || []);
    }).catch(console.error);
  }, [venueId]);

  const coverImage = mediaList.find((m) => m.is_cover) || mediaList[0];
  const title = data.display_name || data.name || 'Untitled Venue';
  const categoryName = data.category || 'Event Venue';
  const price = data.base_price ? `₹${Number(data.base_price).toLocaleString('en-IN')}` : '₹0';
  const unitLabel = data.unit_type === 'hour' ? '/ hour' : data.unit_type === 'half_day' ? '/ half day' : '/ day';
  const locationString = [data.address, (data as any).landmark, data.city].filter(Boolean).join(', ');

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/10 text-pitch text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Step 8: Live Marketplace Preview
          </div>
          <h2 className="text-2xl font-display font-semibold text-ink mb-1">Review your live appearance</h2>
          <p className="text-on-surface-variant text-sm">
            Here is how prospective customers will see your venue on GroundKart across devices.
          </p>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center bg-mist p-1 rounded-xl border border-surface-container shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
              device === 'desktop' ? 'bg-chalk text-pitch shadow-xs' : 'text-on-surface-variant hover:text-ink'
            }`}
          >
            <Monitor className="w-4 h-4" /> Desktop
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
              device === 'mobile' ? 'bg-chalk text-pitch shadow-xs' : 'text-on-surface-variant hover:text-ink'
            }`}
          >
            <Smartphone className="w-4 h-4" /> Mobile
          </button>
        </div>
      </div>

      {/* Preview Container Frame */}
      <div className="flex justify-center bg-mist/60 border border-surface-container-high rounded-2xl p-4 sm:p-8 overflow-hidden">
        <div
          className={`transition-all duration-300 w-full bg-chalk rounded-2xl border border-surface-container shadow-md overflow-hidden ${
            device === 'mobile' ? 'max-w-[380px]' : 'max-w-2xl'
          }`}
        >
          {/* Mock Browser Header Bar */}
          <div className="bg-surface-container-highest/60 border-b border-surface-container px-4 py-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="mx-auto bg-chalk/80 px-4 py-0.5 rounded-md text-[11px] font-mono text-on-surface-variant/70 border border-surface-container truncate max-w-[200px]">
              groundkart.com/venues/{title.toLowerCase().replace(/\s+/g, '-')}
            </div>
          </div>

          {/* Venue Media Showcase */}
          <div className="relative aspect-[16/9] bg-surface-container-high overflow-hidden">
            {coverImage ? (
              <img
                src={coverImage.url}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant/40">
                <Building2 className="w-12 h-12 mb-2" />
                <span className="text-xs font-medium">Cover photo will display here</span>
              </div>
            )}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-full bg-chalk/90 backdrop-blur-md text-[11px] font-bold text-pitch shadow-xs">
                {categoryName}
              </span>
              {(data as any).space_environment && (
                <span className="px-2.5 py-1 rounded-full bg-ink/75 backdrop-blur-md text-[11px] font-semibold text-chalk shadow-xs capitalize">
                  {(data as any).space_environment}
                </span>
              )}
            </div>
            <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-ink/80 backdrop-blur-md text-chalk text-xs font-semibold flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> 5.0 (New)
            </div>
          </div>

          {/* Venue Content Details */}
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl sm:text-2xl font-bold font-display text-ink leading-tight">
                  {title}
                </h3>
                <div className="text-right shrink-0">
                  <div className="text-lg sm:text-xl font-bold font-display text-pitch">
                    {price}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">{unitLabel}</div>
                </div>
              </div>

              {data.tagline && (
                <p className="text-xs sm:text-sm text-pitch font-medium mt-1 italic">
                  "{data.tagline}"
                </p>
              )}

              <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-2">
                <MapPin className="w-3.5 h-3.5 text-pitch shrink-0" />
                <span className="truncate">{locationString || 'Location will display here'}</span>
              </p>
            </div>

            {/* Quick Specs Badges */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-container">
              {data.capacity && (
                <div className="flex items-center gap-1.5 text-xs text-ink bg-mist px-3 py-1.5 rounded-lg border border-surface-container font-medium">
                  <Users className="w-3.5 h-3.5 text-pitch" /> Up to {data.capacity} guests
                </div>
              )}
              {(data as any).area_sqft && (
                <div className="flex items-center gap-1.5 text-xs text-ink bg-mist px-3 py-1.5 rounded-lg border border-surface-container font-medium">
                  <Maximize className="w-3.5 h-3.5 text-pitch" /> {(data as any).area_sqft}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium">
                <Shield className="w-3.5 h-3.5 text-emerald-600" /> Verified Host Space
              </div>
            </div>

            {/* Description Excerpt */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">About the space</h4>
              <p className="text-xs text-ink/80 leading-relaxed line-clamp-3">
                {data.description || 'Your description will provide rich context about your venue.'}
              </p>
            </div>

            {/* Top Amenities */}
            {(data.amenity_names || []).length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">Key Amenities</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(data.amenity_names || []).slice(0, 6).map((amenity) => (
                    <span
                      key={amenity}
                      className="px-2.5 py-1 rounded-md bg-mist text-[11px] font-medium text-ink border border-surface-container"
                    >
                      {amenity}
                    </span>
                  ))}
                  {(data.amenity_names || []).length > 6 && (
                    <span className="px-2 py-1 rounded-md bg-surface-container-high text-[11px] font-semibold text-on-surface-variant">
                      +{(data.amenity_names || []).length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
