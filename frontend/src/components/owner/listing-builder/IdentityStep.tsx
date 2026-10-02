import React from 'react';
import { ListingFormData } from './ListingBuilder';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
}

export default function IdentityStep({ data, update }: Props) {
  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-2">What is the name of your venue?</h2>
        <p className="text-on-surface-variant">Choose a catchy name that guests will remember.</p>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-ink mb-2">
            Venue Name *
          </label>
          <input
            type="text"
            id="name"
            value={data.name || ''}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full rounded-lg border-surface-container-highest px-4 py-3 focus:ring-2 focus:ring-pitch focus:border-pitch"
            placeholder="e.g. Green Meadows Turf, The Grand Banquet"
            maxLength={60}
          />
          <p className="text-xs text-right text-on-surface-variant mt-1">
            {(data.name || '').length} / 60
          </p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-ink mb-2">
            Short Description
          </label>
          <textarea
            id="description"
            value={data.description || ''}
            onChange={(e) => update({ description: e.target.value })}
            rows={4}
            className="w-full rounded-lg border-surface-container-highest px-4 py-3 focus:ring-2 focus:ring-pitch focus:border-pitch"
            placeholder="Tell guests what makes this space special..."
            maxLength={500}
          />
          <p className="text-xs text-right text-on-surface-variant mt-1">
            {(data.description || '').length} / 500
          </p>
        </div>
      </div>
    </div>
  );
}
