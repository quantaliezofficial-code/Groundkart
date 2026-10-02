import React from 'react';
import { ListingFormData } from './ListingBuilder';
import { MapPin } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
}

export default function LocationStep({ data, update }: Props) {
  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-2">Where is your venue located?</h2>
        <p className="text-on-surface-variant">Your address is only shared with guests after they've made a booking.</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Street Address</label>
          <input
            type="text"
            value={data.address || ''}
            onChange={e => update({ address: e.target.value })}
            className="w-full rounded-lg border border-surface-container-highest px-4 py-3 focus:ring-2 focus:ring-pitch"
            placeholder="House, Flat, Bldg, etc."
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">City</label>
            <input
              type="text"
              value={data.city || ''}
              onChange={e => update({ city: e.target.value })}
              className="w-full rounded-lg border border-surface-container-highest px-4 py-3 focus:ring-2 focus:ring-pitch"
              placeholder="e.g. Lucknow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">State / Province</label>
            <input
              type="text"
              value={data.state || ''}
              onChange={e => update({ state: e.target.value })}
              className="w-full rounded-lg border border-surface-container-highest px-4 py-3 focus:ring-2 focus:ring-pitch"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Pincode / Postal Code</label>
          <input
            type="text"
            value={data.pincode || ''}
            onChange={e => update({ pincode: e.target.value })}
            className="w-full md:w-1/2 rounded-lg border border-surface-container-highest px-4 py-3 focus:ring-2 focus:ring-pitch"
          />
        </div>
      </div>

      <div className="bg-mist rounded-xl p-6 border border-surface-container-highest flex items-center justify-center min-h-[200px]">
        <div className="text-center text-on-surface-variant flex flex-col items-center">
          <MapPin className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">Map pin will be placed automatically based on address.</p>
        </div>
      </div>
    </div>
  );
}
