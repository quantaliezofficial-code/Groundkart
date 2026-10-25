import React, { useState, useEffect } from 'react';
import { ListingFormData } from './ListingBuilder';
import { ownerApi } from '../../../lib/api/owner';
import { UnitType, VenueRentalOption } from '../../../lib/api/types';
import { CircleDollarSign, Clock, ShieldCheck, Check, AlertCircle } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

interface ModeConfig {
  enabled: boolean;
  price: string;
  open_time: string;
  close_time: string;
  slot_minutes: number;
  min_minutes: number;
  max_minutes: number;
  buffer_minutes: number;
}

const DEFAULT_CONFIGS: Record<UnitType, ModeConfig> = {
  hour: {
    enabled: true,
    price: '2000',
    open_time: '06:00',
    close_time: '23:00',
    slot_minutes: 60,
    min_minutes: 60,
    max_minutes: 480,
    buffer_minutes: 15,
  },
  half_day: {
    enabled: false,
    price: '8000',
    open_time: '06:00',
    close_time: '14:00',
    slot_minutes: 360,
    min_minutes: 360,
    max_minutes: 360,
    buffer_minutes: 30,
  },
  full_day: {
    enabled: false,
    price: '15000',
    open_time: '06:00',
    close_time: '23:00',
    slot_minutes: 1020,
    min_minutes: 1020,
    max_minutes: 1020,
    buffer_minutes: 60,
  },
};

export default function RentalSetupStep({ data, update, venueId }: Props) {
  const [configs, setConfigs] = useState<Record<UnitType, ModeConfig>>(() => {
    if ((data as any).rental_configs) {
      return (data as any).rental_configs;
    }
    const initial = { ...DEFAULT_CONFIGS };
    if (data.unit_type) {
      initial.hour.enabled = data.unit_type === 'hour';
      initial.half_day.enabled = data.unit_type === 'half_day';
      initial.full_day.enabled = data.unit_type === 'full_day';
      if (data.base_price) {
        initial[data.unit_type].price = String(data.base_price);
      }
    }
    return initial;
  });

  // Load backend rental options if venueId exists
  useEffect(() => {
    if (!venueId) return;
    ownerApi.listRentalOptions(venueId).then((options) => {
      if (options.length > 0) {
        setConfigs((prev) => {
          const next = { ...prev };
          options.forEach((opt) => {
            if (next[opt.mode]) {
              next[opt.mode] = {
                enabled: opt.enabled,
                price: opt.price,
                open_time: opt.open_time ? opt.open_time.slice(0, 5) : next[opt.mode].open_time,
                close_time: opt.close_time ? opt.close_time.slice(0, 5) : next[opt.mode].close_time,
                slot_minutes: opt.slot_minutes ?? next[opt.mode].slot_minutes,
                min_minutes: opt.min_minutes ?? next[opt.mode].min_minutes,
                max_minutes: opt.max_minutes ?? next[opt.mode].max_minutes,
                buffer_minutes: opt.buffer_minutes ?? next[opt.mode].buffer_minutes,
              };
            }
          });
          update({ rental_configs: next } as any);
          return next;
        });
      }
    }).catch((err) => console.error('Failed to load rental options', err));
  }, [venueId]);

  const syncWithVenue = async (updatedConfigs: Record<UnitType, ModeConfig>) => {
    // Find cheapest enabled mode to sync with venue.unit_type & venue.base_price
    const enabledModes = (['hour', 'half_day', 'full_day'] as UnitType[]).filter(
      (m) => updatedConfigs[m].enabled && parseFloat(updatedConfigs[m].price || '0') > 0
    );

    if (enabledModes.length > 0) {
      let cheapestMode = enabledModes[0];
      let minPrice = parseFloat(updatedConfigs[cheapestMode].price);
      for (const m of enabledModes) {
        const p = parseFloat(updatedConfigs[m].price);
        if (p < minPrice) {
          minPrice = p;
          cheapestMode = m;
        }
      }

      update({
        unit_type: cheapestMode,
        base_price: String(minPrice),
        rental_configs: updatedConfigs,
      } as any);

      // Persist to backend if venueId exists
      if (venueId) {
        for (const mode of ['hour', 'half_day', 'full_day'] as UnitType[]) {
          const cfg = updatedConfigs[mode];
          try {
            await ownerApi.createRentalOption(venueId, {
              mode,
              price: cfg.price || '0',
              open_time: cfg.open_time,
              close_time: cfg.close_time,
              slot_minutes: cfg.slot_minutes,
              min_minutes: cfg.min_minutes,
              max_minutes: cfg.max_minutes,
              buffer_minutes: cfg.buffer_minutes,
              enabled: cfg.enabled,
            });
          } catch (e) {
            // Option may already exist, update it
            try {
              const all = await ownerApi.listRentalOptions(venueId);
              const found = all.find((o) => o.mode === mode);
              if (found) {
                await ownerApi.updateRentalOption(venueId, found.id, {
                  price: cfg.price || '0',
                  open_time: cfg.open_time,
                  close_time: cfg.close_time,
                  slot_minutes: cfg.slot_minutes,
                  min_minutes: cfg.min_minutes,
                  max_minutes: cfg.max_minutes,
                  buffer_minutes: cfg.buffer_minutes,
                  enabled: cfg.enabled,
                });
              }
            } catch (err) {
              console.error('Failed updating option', mode, err);
            }
          }
        }
      }
    } else {
      update({ rental_configs: updatedConfigs } as any);
    }
  };

  const handleToggleMode = (mode: UnitType) => {
    const updated = {
      ...configs,
      [mode]: {
        ...configs[mode],
        enabled: !configs[mode].enabled,
      },
    };
    setConfigs(updated);
    update({ rental_configs: updated } as any);
    syncWithVenue(updated);
  };

  const handleChangeField = (mode: UnitType, field: keyof ModeConfig, value: any) => {
    const updated = {
      ...configs,
      [mode]: {
        ...configs[mode],
        [field]: value,
      },
    };
    setConfigs(updated);
    update({ rental_configs: updated } as any);
    syncWithVenue(updated);
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold/15 text-pitch text-xs font-bold border border-marigold/30 mb-3">
          <CircleDollarSign className="w-3.5 h-3.5 text-pitch" /> Step 6: Rental Setup
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">How would you like to rent your space?</h2>
        <p className="text-on-surface-variant text-sm">
          A lawn or hall can offer hourly bookings for practice/tournaments and full-day bookings for weddings. Enable the rental options that fit your venue.
        </p>
      </div>

      <div className="space-y-6">
        {/* Hourly Option */}
        <div className={`p-5 rounded-2xl border transition-all ${
          configs.hour.enabled ? 'border-pitch bg-emerald-50/50 ring-1 ring-pitch/20 shadow-xs' : 'border-surface-container bg-chalk opacity-85'
        }`}>
          <div className="flex items-start justify-between">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={configs.hour.enabled}
                onChange={() => handleToggleMode('hour')}
                className="w-5 h-5 rounded text-pitch focus:ring-marigold accent-pitch cursor-pointer"
              />
              <div>
                <span className="font-bold text-ink text-base">Hourly Rental</span>
                <p className="text-xs text-on-surface-variant">Ideal for turf games, hourly practice, photography sessions, or short meetings</p>
              </div>
            </label>
            {configs.hour.enabled && (
              <span className="text-xs font-bold text-pitch bg-marigold/20 border border-marigold/40 px-2.5 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>

          {configs.hour.enabled && (
            <div className="mt-5 pt-4 border-t border-surface-container grid grid-cols-1 sm:grid-cols-3 gap-4 animation-fade-in">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Price per Hour (₹) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  value={configs.hour.price}
                  onChange={(e) => handleChangeField('hour', 'price', e.target.value)}
                  min={1}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-marigold/70 focus:border-pitch"
                  placeholder="2000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Daily Opening Time</label>
                <input
                  type="time"
                  value={configs.hour.open_time}
                  onChange={(e) => handleChangeField('hour', 'open_time', e.target.value)}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Daily Closing Time</label>
                <input
                  type="time"
                  value={configs.hour.close_time}
                  onChange={(e) => handleChangeField('hour', 'close_time', e.target.value)}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Slot Length</label>
                <select
                  value={configs.hour.slot_minutes}
                  onChange={(e) => handleChangeField('hour', 'slot_minutes', parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={90}>90 Minutes</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Minimum Booking</label>
                <select
                  value={configs.hour.min_minutes}
                  onChange={(e) => handleChangeField('hour', 'min_minutes', parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                >
                  <option value={60}>1 Hour Minimum</option>
                  <option value={120}>2 Hours Minimum</option>
                  <option value={180}>3 Hours Minimum</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Buffer / Clean-up Gap</label>
                <select
                  value={configs.hour.buffer_minutes}
                  onChange={(e) => handleChangeField('hour', 'buffer_minutes', parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                >
                  <option value={0}>No buffer</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Half Day Option */}
        <div className={`p-5 rounded-2xl border transition-all ${
          configs.half_day.enabled ? 'border-pitch bg-primary-container/5 ring-1 ring-pitch/30 shadow-xs' : 'border-surface-container bg-chalk opacity-85'
        }`}>
          <div className="flex items-start justify-between">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={configs.half_day.enabled}
                onChange={() => handleToggleMode('half_day')}
                className="w-5 h-5 rounded text-pitch focus:ring-pitch cursor-pointer"
              />
              <div>
                <span className="font-bold text-ink text-base">Half Day Rental</span>
                <p className="text-xs text-on-surface-variant">Ideal for seminars, morning ceremonies, evening parties, or corporate workshops</p>
              </div>
            </label>
            {configs.half_day.enabled && <span className="text-xs font-bold text-pitch bg-pitch/10 px-2.5 py-0.5 rounded-full">Active</span>}
          </div>

          {configs.half_day.enabled && (
            <div className="mt-5 pt-4 border-t border-surface-container grid grid-cols-1 sm:grid-cols-3 gap-4 animation-fade-in">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Price per Half Day (₹) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  value={configs.half_day.price}
                  onChange={(e) => handleChangeField('half_day', 'price', e.target.value)}
                  min={1}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-pitch"
                  placeholder="8000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Slot Window Start</label>
                <input
                  type="time"
                  value={configs.half_day.open_time}
                  onChange={(e) => handleChangeField('half_day', 'open_time', e.target.value)}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Slot Window End</label>
                <input
                  type="time"
                  value={configs.half_day.close_time}
                  onChange={(e) => handleChangeField('half_day', 'close_time', e.target.value)}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                />
              </div>
            </div>
          )}
        </div>

        {/* Full Day Option */}
        <div className={`p-5 rounded-2xl border transition-all ${
          configs.full_day.enabled ? 'border-pitch bg-primary-container/5 ring-1 ring-pitch/30 shadow-xs' : 'border-surface-container bg-chalk opacity-85'
        }`}>
          <div className="flex items-start justify-between">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={configs.full_day.enabled}
                onChange={() => handleToggleMode('full_day')}
                className="w-5 h-5 rounded text-pitch focus:ring-pitch cursor-pointer"
              />
              <div>
                <span className="font-bold text-ink text-base">Full Day Rental</span>
                <p className="text-xs text-on-surface-variant">Ideal for weddings, all-day exhibitions, full tournaments, or family celebrations</p>
              </div>
            </label>
            {configs.full_day.enabled && <span className="text-xs font-bold text-pitch bg-pitch/10 px-2.5 py-0.5 rounded-full">Active</span>}
          </div>

          {configs.full_day.enabled && (
            <div className="mt-5 pt-4 border-t border-surface-container grid grid-cols-1 sm:grid-cols-3 gap-4 animation-fade-in">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Price per Full Day (₹) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  value={configs.full_day.price}
                  onChange={(e) => handleChangeField('full_day', 'price', e.target.value)}
                  min={1}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-pitch"
                  placeholder="25000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Check-in / Open Time</label>
                <input
                  type="time"
                  value={configs.full_day.open_time}
                  onChange={(e) => handleChangeField('full_day', 'open_time', e.target.value)}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Check-out / Close Time</label>
                <input
                  type="time"
                  value={configs.full_day.close_time}
                  onChange={(e) => handleChangeField('full_day', 'close_time', e.target.value)}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
