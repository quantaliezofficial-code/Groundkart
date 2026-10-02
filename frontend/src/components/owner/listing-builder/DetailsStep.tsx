import React, { useState } from 'react';
import { ListingFormData } from './ListingBuilder';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
}

export default function DetailsStep({ data, update }: Props) {
  const [newAmenity, setNewAmenity] = useState('');

  const addAmenity = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    
    if (newAmenity.trim() && !(data.amenity_names || []).includes(newAmenity.trim())) {
      update({ amenity_names: [...(data.amenity_names || []), newAmenity.trim()] });
      setNewAmenity('');
    }
  };

  const removeAmenity = (name: string) => {
    update({ amenity_names: (data.amenity_names || []).filter(a => a !== name) });
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-2">Almost there!</h2>
        <p className="text-on-surface-variant">Set your base pricing, capacity, and amenities.</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Base Price</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-on-surface-variant">₹</span>
              <input
                type="number"
                value={data.base_price || ''}
                onChange={e => update({ base_price: e.target.value })}
                className="w-full rounded-lg border border-surface-container-highest pl-8 pr-4 py-3 focus:ring-2 focus:ring-pitch"
                placeholder="1000"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Unit Type</label>
            <select
              value={data.unit_type || 'hour'}
              onChange={e => update({ unit_type: e.target.value as any })}
              className="w-full rounded-lg border border-surface-container-highest px-4 py-3 focus:ring-2 focus:ring-pitch bg-chalk"
            >
              <option value="hour">Per Hour</option>
              <option value="half_day">Per Half Day</option>
              <option value="day">Per Day</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Capacity</label>
          <input
            type="number"
            value={data.capacity || ''}
            onChange={e => update({ capacity: parseInt(e.target.value) || undefined })}
            className="w-full md:w-1/2 rounded-lg border border-surface-container-highest px-4 py-3 focus:ring-2 focus:ring-pitch"
            placeholder="Maximum guests/players"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-3">Amenities</label>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newAmenity}
              onChange={e => setNewAmenity(e.target.value)}
              onKeyDown={addAmenity}
              className="flex-1 rounded-lg border border-surface-container-highest px-4 py-2 focus:ring-2 focus:ring-pitch text-sm"
              placeholder="e.g. Floodlights, Parking, WiFi..."
            />
            <button 
              onClick={addAmenity}
              className="bg-mist hover:bg-surface-container-highest text-ink px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-surface-container-highest"
            >
              Add
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(data.amenity_names || []).map(amenity => (
              <span key={amenity} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mist border border-surface-container-highest text-sm text-ink">
                {amenity}
                <button onClick={() => removeAmenity(amenity)} className="text-on-surface-variant hover:text-error">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
