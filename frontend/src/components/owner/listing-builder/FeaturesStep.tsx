import React, { useState } from 'react';
import { ListingFormData } from './ListingBuilder';
import { Sparkles, Check, Plus, X, Users, Maximize, Shield, Utensils, Music, Car, Wifi } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

interface AmenityGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
}

const AMENITY_GROUPS: AmenityGroup[] = [
  {
    id: 'comfort',
    title: 'Comfort & Facilities',
    icon: Wifi,
    items: [
      'High-Speed Wi-Fi',
      'Air Conditioning',
      'Power Backup / Generator',
      'Restrooms / Washrooms',
      'Changing Rooms / Green Room',
      'Wheelchair Accessible',
      'Elevator Access',
      'Heating',
    ],
  },
  {
    id: 'parking',
    title: 'Parking & Arrival',
    icon: Car,
    items: [
      'Free On-site Parking',
      'Valet Parking Available',
      'Dedicated Paid Parking',
      'Ample Street Parking',
      'Near Metro / Public Transit',
    ],
  },
  {
    id: 'av_tech',
    title: 'Audio-Visual & Staging',
    icon: Music,
    items: [
      'Professional Sound System',
      'Wireless Microphones',
      'Projector & Screen',
      'Raised Stage / Podium',
      'LED Video Wall',
      'Night Floodlights',
      'Studio Production Lights',
    ],
  },
  {
    id: 'catering',
    title: 'Hospitality & Dining',
    icon: Utensils,
    items: [
      'Outside Catering Allowed',
      'In-house Catering Available',
      'Kitchen / Pantry Setup',
      'Dining Tables & Chairs Provided',
      'Clean Drinking Water',
      'Bar Counter Area',
      'Refrigeration Facilities',
    ],
  },
  {
    id: 'safety',
    title: 'Safety & Security',
    icon: Shield,
    items: [
      'CCTV Surveillance',
      '24/7 Security Personnel',
      'Fire Extinguishers',
      'First Aid Kit',
      'On-site Venue Manager',
    ],
  },
  {
    id: 'sports',
    title: 'Sports & Field Gear',
    icon: Sparkles,
    items: [
      'FIFA / Standard Turf Grass',
      'Goalposts & Nets',
      'Dugout / Player Benches',
      'Sports Gear Rental',
      'Electronic Scoreboard',
      'Spectator Seating',
    ],
  },
];

export default function FeaturesStep({ data, update }: Props) {
  const [newAmenity, setNewAmenity] = useState('');
  const [activeTab, setActiveTab] = useState<string>('comfort');

  const selectedAmenities = data.amenity_names || [];

  const toggleAmenity = (name: string) => {
    if (selectedAmenities.includes(name)) {
      update({ amenity_names: selectedAmenities.filter((a) => a !== name) });
    } else {
      update({ amenity_names: [...selectedAmenities, name] });
    }
  };

  const addCustomAmenity = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = newAmenity.trim();
    if (trimmed && !selectedAmenities.includes(trimmed)) {
      update({ amenity_names: [...selectedAmenities, trimmed] });
      setNewAmenity('');
    }
  };

  const removeAmenity = (name: string) => {
    update({ amenity_names: selectedAmenities.filter((a) => a !== name) });
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/10 text-pitch text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Step 5: Features & Amenities
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">Space specs & facilities</h2>
        <p className="text-on-surface-variant text-sm">
          Highlight what your venue offers. Complete amenity profiles make venues 4x more likely to be selected by organizers.
        </p>
      </div>

      <div className="space-y-6">
        {/* Space Capacity & Dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4.5 rounded-xl bg-mist border border-surface-container">
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-pitch" /> Maximum Capacity (Guests / Players)
            </label>
            <input
              type="number"
              value={data.capacity || ''}
              onChange={(e) => update({ capacity: parseInt(e.target.value) || undefined })}
              className="w-full rounded-lg border border-surface-container-highest px-3.5 py-2.5 text-sm bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
              placeholder="e.g. 50, 200, 500"
              min={1}
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Estimated total simultaneous occupancy.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Maximize className="w-3.5 h-3.5 text-pitch" /> Space Area (Sq. Ft. / Dimensions)
            </label>
            <input
              type="text"
              value={(data as any).area_sqft || ''}
              onChange={(e) => update({ ...data, area_sqft: e.target.value } as any)}
              className="w-full rounded-lg border border-surface-container-highest px-3.5 py-2.5 text-sm bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
              placeholder="e.g. 4,500 sq ft or 100 x 60 ft"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Helps planners visualize layout and staging.
            </p>
          </div>
        </div>

        {/* Selected Amenities Pill Summary */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Selected Amenities ({selectedAmenities.length})
            </span>
            {selectedAmenities.length > 0 && (
              <button
                type="button"
                onClick={() => update({ amenity_names: [] })}
                className="text-xs text-on-surface-variant hover:text-rose-600 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="min-h-[46px] p-2.5 rounded-xl border border-surface-container-highest bg-chalk flex flex-wrap gap-1.5">
            {selectedAmenities.length === 0 ? (
              <span className="text-xs text-on-surface-variant/70 italic px-2 py-1">
                Select from the categories below or type custom amenities.
              </span>
            ) : (
              selectedAmenities.map((amenity) => (
                <span
                  key={amenity}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container/20 border border-pitch/30 text-xs font-medium text-pitch"
                >
                  <Check className="w-3 h-3 text-pitch" />
                  <span>{amenity}</span>
                  <button
                    type="button"
                    onClick={() => removeAmenity(amenity)}
                    className="hover:bg-pitch/20 rounded-full p-0.5 transition-colors"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Custom Amenity Adder */}
        <div>
          <label className="block text-xs font-semibold text-ink mb-1.5">
            Add Custom Feature / Amenity
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newAmenity}
              onChange={(e) => setNewAmenity(e.target.value)}
              onKeyDown={addCustomAmenity}
              className="flex-1 rounded-xl border border-surface-container-highest px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
              placeholder="e.g. Swimming Pool, Heated Jacuzzi, Drone Photography Allowed..."
            />
            <button
              type="button"
              onClick={addCustomAmenity}
              className="px-4 py-2 bg-pitch hover:bg-ink text-chalk rounded-xl text-xs font-semibold transition-all flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Categorized Pre-defined Amenities Tabs & Chips */}
        <div className="pt-3 border-t border-surface-container">
          <label className="block text-sm font-semibold text-ink mb-3">
            Browse Popular Amenities by Category
          </label>

          {/* Group Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-4">
            {AMENITY_GROUPS.map((group) => {
              const IconComp = group.icon;
              const isCurrent = activeTab === group.id;
              const selectedCount = group.items.filter((i) => selectedAmenities.includes(i)).length;
              return (
                <button
                  type="button"
                  key={group.id}
                  onClick={() => setActiveTab(group.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all ${
                    isCurrent
                      ? 'bg-pitch text-chalk shadow-xs'
                      : 'bg-mist text-ink hover:bg-surface-container-highest'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{group.title}</span>
                  {selectedCount > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isCurrent ? 'bg-chalk text-pitch' : 'bg-pitch text-chalk'
                      }`}
                    >
                      {selectedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Group Items Grid */}
          {AMENITY_GROUPS.filter((g) => g.id === activeTab).map((group) => (
            <div key={group.id} className="grid grid-cols-2 sm:grid-cols-3 gap-2 animation-fade-in">
              {group.items.map((item) => {
                const isSelected = selectedAmenities.includes(item);
                return (
                  <button
                    type="button"
                    key={item}
                    onClick={() => toggleAmenity(item)}
                    className={`p-3 rounded-xl border text-xs text-left font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-pitch bg-primary-container/20 text-pitch font-semibold ring-1 ring-pitch'
                        : 'border-surface-container-highest bg-chalk hover:bg-mist text-ink hover:border-pitch/40'
                    }`}
                  >
                    <span>{item}</span>
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ml-1.5 transition-colors ${
                        isSelected ? 'bg-pitch text-chalk' : 'border border-surface-container-high'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
