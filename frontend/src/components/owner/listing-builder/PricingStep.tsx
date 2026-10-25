import React from 'react';
import { ListingFormData } from './ListingBuilder';
import { UnitType } from '../../../lib/api/types';
import { CircleDollarSign, Clock, Calendar, Check, ShieldCheck, ArrowRight } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

interface UnitOption {
  value: UnitType;
  label: string;
  desc: string;
}

const UNIT_OPTIONS: UnitOption[] = [
  { value: 'hour', label: 'Per Hour', desc: 'Ideal for sports turfs, meetings, photography studios' },
  { value: 'half_day', label: 'Per Half Day (4-6 hrs)', desc: 'Ideal for workshops, seminars, morning/evening sessions' },
  { value: 'full_day', label: 'Per Day / Full Event', desc: 'Ideal for banquets, weddings, parties, full-day tournaments' },
];

const OPERATING_DAY_OPTIONS = [
  { id: 'all', label: 'All 7 Days (Mon - Sun)' },
  { id: 'weekdays', label: 'Weekdays Only (Mon - Fri)' },
  { id: 'weekends', label: 'Weekends Only (Sat - Sun)' },
];

export default function PricingStep({ data, update }: Props) {
  const priceNum = parseFloat(String(data.base_price || '0')) || 0;
  // Estimated owner take-home (assuming standard 5% platform fee)
  const platformFee = Math.round(priceNum * 0.05);
  const netEarnings = Math.max(0, priceNum - platformFee);

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/10 text-pitch text-xs font-semibold mb-3">
          <CircleDollarSign className="w-3.5 h-3.5" /> Step 6: Pricing & Schedule
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">Set pricing & operating hours</h2>
        <p className="text-on-surface-variant text-sm">
          Define how guests book your space, your base pricing structure, and daily availability windows.
        </p>
      </div>

      <div className="space-y-6">
        {/* Pricing Model & Unit */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Pricing Unit <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {UNIT_OPTIONS.map((opt) => {
              const isSelected = (data.unit_type || 'hour') === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => update({ unit_type: opt.value })}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-pitch bg-primary-container/15 ring-2 ring-pitch text-pitch font-medium shadow-xs'
                      : 'border-surface-container-highest hover:border-pitch/40 bg-chalk text-ink hover:bg-mist'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm flex items-center justify-between">
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-pitch" />}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-snug">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Base Price Input & Earnings Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">
              Base Price ({data.unit_type === 'hour' ? 'per hour' : data.unit_type === 'half_day' ? 'per half day' : 'per full day'}) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-lg font-bold text-on-surface-variant font-display">₹</span>
              <input
                type="number"
                value={data.base_price || ''}
                onChange={(e) => update({ base_price: e.target.value })}
                className="w-full rounded-xl border border-surface-container-highest pl-9 pr-4 py-3 text-lg font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-pitch transition-all"
                placeholder="2000"
                min={0}
                required
              />
            </div>
            <p className="text-xs text-on-surface-variant mt-1.5">
              The public rate displayed to customers before any custom date surge.
            </p>
          </div>

          {/* Earnings calculator card */}
          <div className="rounded-xl border border-surface-container bg-mist p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Estimated Host Payout
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-pitch">
                  ₹{netEarnings.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-on-surface-variant">/ booking</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-surface-container-high/80 text-[11px] text-on-surface-variant space-y-1">
              <div className="flex justify-between">
                <span>Guest subtotal:</span>
                <span className="font-medium text-ink">₹{priceNum.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform processing fee (5%):</span>
                <span>-₹{platformFee.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Operating Schedule */}
        <div className="pt-4 border-t border-surface-container">
          <label className="block text-sm font-semibold text-ink mb-2.5">
            Operational Schedule & Days
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
            {OPERATING_DAY_OPTIONS.map((dayOpt) => {
              const isSelected = (data.operating_days || 'all') === dayOpt.id;
              return (
                <button
                  type="button"
                  key={dayOpt.id}
                  onClick={() => update({ operating_days: dayOpt.id })}
                  className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                    isSelected
                      ? 'border-pitch bg-pitch text-chalk shadow-xs'
                      : 'border-surface-container-highest bg-mist text-ink hover:bg-surface-container-highest'
                  }`}
                >
                  {dayOpt.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-pitch" /> Opening Time
              </label>
              <input
                type="time"
                value={data.open_time || '06:00'}
                onChange={(e) => update({ open_time: e.target.value })}
                className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-sm bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-pitch" /> Closing Time
              </label>
              <input
                type="time"
                value={data.close_time || '23:00'}
                onChange={(e) => update({ close_time: e.target.value })}
                className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-sm bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </div>
          </div>
        </div>

        {/* Booking Guidelines & Minimum Hours */}
        <div className="p-3.5 rounded-xl bg-mist border border-surface-container flex items-start gap-3 text-xs text-on-surface-variant">
          <Calendar className="w-4 h-4 text-pitch shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-ink text-sm">Flexible Calendar Management</p>
            <p className="mt-0.5 leading-relaxed">
              Once onboarded, you can use the <strong>Owner Calendar</strong> to block maintenance days, customize slot prices for holidays, or configure automated recurring inventory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
