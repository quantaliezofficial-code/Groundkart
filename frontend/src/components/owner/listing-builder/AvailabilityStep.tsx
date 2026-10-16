import React from 'react';
import { ListingFormData } from './ListingBuilder';
import { ownerApi } from '../../../lib/api/owner';
import { Calendar } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

export default function AvailabilityStep({ data, update, venueId }: Props) {
  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-2">Availability</h2>
        <p className="text-on-surface-variant">When can guests book your venue?</p>
      </div>
      <div className="bg-mist p-8 rounded-xl border border-surface-container-highest flex flex-col items-center text-center">
        <Calendar className="w-12 h-12 text-on-surface-variant mb-4 opacity-50" />
        <h3 className="font-semibold text-ink mb-2">Set up availability from your Calendar</h3>
        <p className="text-sm text-on-surface-variant max-w-sm mb-6">
          Once your venue is created, you can use the Owner Calendar dashboard to add inventory units and manage your schedule.
        </p>
      </div>
    </div>
  );
}
