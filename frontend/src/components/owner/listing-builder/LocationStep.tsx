import React from 'react';
import { ListingFormData } from './ListingBuilder';
import { MapPin, Navigation, Car, Compass } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
}

const POPULAR_CITIES = ['Lucknow', 'Delhi NCR', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Kolkata'];

export default function LocationStep({ data, update }: Props) {
  const fullAddressPreview = [
    data.address,
    (data as any).landmark,
    data.city,
    data.state,
    data.pincode,
  ].filter(Boolean).join(', ');

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/10 text-pitch text-xs font-semibold mb-3">
          <MapPin className="w-3.5 h-3.5" /> Step 3: Location & Accessibility
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">Where is your space situated?</h2>
        <p className="text-on-surface-variant text-sm">
          Precise location and access instructions ensure a smooth arrival experience for your guests and teams.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Street Address / Premise <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={data.address || ''}
            onChange={(e) => update({ address: e.target.value })}
            className="w-full rounded-xl border border-surface-container-highest px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-pitch transition-all text-sm"
            placeholder="Plot No., Building Name, Street / Road Name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Prominent Landmark / Locality
          </label>
          <div className="relative">
            <input
              type="text"
              value={(data as any).landmark || ''}
              onChange={(e) => update({ ...data, landmark: e.target.value } as any)}
              className="w-full rounded-xl border border-surface-container-highest px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-pitch transition-all text-sm pl-10"
              placeholder="e.g. Near Gomti Barrage, Opposite Central Park"
            />
            <Compass className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">
              City <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={data.city || ''}
              onChange={(e) => update({ city: e.target.value })}
              className="w-full rounded-xl border border-surface-container-highest px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-pitch transition-all text-sm"
              placeholder="e.g. Lucknow"
              required
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {POPULAR_CITIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => update({ city: c })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    data.city === c
                      ? 'border-pitch bg-pitch text-chalk font-medium'
                      : 'border-surface-container-highest bg-mist text-on-surface-variant hover:text-ink hover:border-pitch/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">
              State / Province
            </label>
            <input
              type="text"
              value={data.state || ''}
              onChange={(e) => update({ state: e.target.value })}
              className="w-full rounded-xl border border-surface-container-highest px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-pitch transition-all text-sm"
              placeholder="e.g. Uttar Pradesh"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Postal / Pincode
          </label>
          <input
            type="text"
            value={data.pincode || ''}
            onChange={(e) => update({ pincode: e.target.value })}
            className="w-full sm:w-1/2 rounded-xl border border-surface-container-highest px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-pitch transition-all text-sm"
            placeholder="e.g. 226010"
            maxLength={10}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Arrival & Entry Instructions for Guests
          </label>
          <div className="relative">
            <textarea
              value={(data as any).access_notes || ''}
              onChange={(e) => update({ ...data, access_notes: e.target.value } as any)}
              className="w-full rounded-xl border border-surface-container-highest p-4 text-ink focus:outline-none focus:ring-2 focus:ring-pitch min-h-[90px] text-sm leading-relaxed"
              placeholder="e.g. Enter through South Gate 2. Elevator accessible from basement parking lot B. Inform security you have a GroundKart booking."
            />
          </div>
          <p className="text-xs text-on-surface-variant mt-1.5">
            Shared with confirmed guests on their booking voucher and reminder notifications.
          </p>
        </div>

        {/* Live Address Card Preview */}
        <div className="rounded-xl border border-surface-container-high bg-mist/60 p-4.5 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-full bg-pitch/10 flex items-center justify-center shrink-0 text-pitch">
            <Navigation className="w-4 h-4" />
          </div>
          <div className="text-xs text-on-surface-variant leading-relaxed">
            <p className="font-semibold text-ink text-sm mb-0.5">Address display verification</p>
            <p className="font-mono text-xs text-pitch font-medium break-words">
              {fullAddressPreview || 'Your complete address preview will appear here as you type.'}
            </p>
            <p className="text-on-surface-variant/80 mt-1">
              Exact street directions will be released to guests once their reservation is confirmed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
