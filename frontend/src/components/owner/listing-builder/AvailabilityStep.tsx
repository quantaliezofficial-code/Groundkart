import React, { useState, useEffect } from 'react';
import { ListingFormData } from './ListingBuilder';
import { ownerApi } from '../../../lib/api/owner';
import { InventoryUnitCreateRequest } from '../../../lib/api/types';
import { useToast } from '../../ui/Toast';
import { Calendar, Clock, Check, Sparkles, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

interface DayOption {
  dayNum: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  label: string;
  short: string;
}

const DAYS_OF_WEEK: DayOption[] = [
  { dayNum: 1, label: 'Monday', short: 'Mon' },
  { dayNum: 2, label: 'Tuesday', short: 'Tue' },
  { dayNum: 3, label: 'Wednesday', short: 'Wed' },
  { dayNum: 4, label: 'Thursday', short: 'Thu' },
  { dayNum: 5, label: 'Friday', short: 'Fri' },
  { dayNum: 6, label: 'Saturday', short: 'Sat' },
  { dayNum: 0, label: 'Sunday', short: 'Sun' },
];

export default function AvailabilityStep({ data, update, venueId }: Props) {
  const [selectedDays, setSelectedDays] = useState<number[]>(() =>
    (data as any).availability_config?.selectedDays ?? [1, 2, 3, 4, 5, 6, 0]
  );
  const [startTime, setStartTime] = useState<string>(() =>
    (data as any).availability_config?.startTime ?? '09:00'
  );
  const [endTime, setEndTime] = useState<string>(() =>
    (data as any).availability_config?.endTime ?? '21:00'
  );
  const [slotDurationHours, setSlotDurationHours] = useState<number>(() =>
    (data as any).availability_config?.slotDurationHours ?? 1
  );
  const [customPrice, setCustomPrice] = useState<string>(() =>
    (data as any).availability_config?.customPrice ?? ''
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(Boolean(venueId));
  const [futureSlotsCount, setFutureSlotsCount] = useState<number>(() =>
    (data as any).availability_config?.futureSlotsCount ?? 0
  );
  const toast = useToast();

  const isHourly = (data.unit_type || 'hour') === 'hour';

  const persistConfig = (patch: Partial<{
    selectedDays: number[];
    startTime: string;
    endTime: string;
    slotDurationHours: number;
    customPrice: string;
    futureSlotsCount: number;
  }>) => {
    update?.({
      availability_config: {
        selectedDays,
        startTime,
        endTime,
        slotDurationHours,
        customPrice,
        futureSlotsCount,
        ...patch,
      },
    } as any);
  };

  const fetchExistingSlots = async () => {
    if (!venueId) return;
    setIsLoadingSlots(true);
    try {
      const units = await ownerApi.listInventoryUnits(venueId);
      const todayStr = new Date().toISOString().split('T')[0];
      const futureAvailable = units.filter((u) => u.date >= todayStr && u.status === 'available');
      setFutureSlotsCount(futureAvailable.length);
      persistConfig({ futureSlotsCount: futureAvailable.length });
    } catch (err) {
      console.error('Failed to load inventory units:', err);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    fetchExistingSlots();
  }, [venueId]);

  const toggleDay = (dayNum: number) => {
    let nextDays: number[];
    if (selectedDays.includes(dayNum)) {
      if (selectedDays.length === 1) {
        toast.error('Select at least one active day of the week');
        return;
      }
      nextDays = selectedDays.filter((d) => d !== dayNum);
    } else {
      nextDays = [...selectedDays, dayNum];
    }
    setSelectedDays(nextDays);
    persistConfig({ selectedDays: nextDays });
  };

  const setDaysPreset = (days: number[]) => {
    setSelectedDays(days);
    persistConfig({ selectedDays: days });
  };

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    persistConfig({ startTime: val });
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    persistConfig({ endTime: val });
  };

  const handleSlotDurationChange = (val: number) => {
    setSlotDurationHours(val);
    persistConfig({ slotDurationHours: val });
  };

  const handleCustomPriceChange = (val: string) => {
    setCustomPrice(val);
    persistConfig({ customPrice: val });
  };

  const handleGenerateInventory = async () => {
    if (!venueId) {
      toast.error('Please complete the initial steps so your venue draft is saved before generating slots.');
      return;
    }

    if (selectedDays.length === 0) {
      toast.error('Please select at least one day of the week.');
      return;
    }

    if (isHourly) {
      const startH = parseInt(startTime.split(':')[0], 10);
      const endH = parseInt(endTime.split(':')[0], 10);
      if (isNaN(startH) || isNaN(endH) || startH >= endH) {
        toast.error('Opening time must be earlier than closing time.');
        return;
      }
    }

    setIsGenerating(true);

    try {
      const unitsToCreate: InventoryUnitCreateRequest[] = [];
      const now = new Date();
      // Generate slots for next 30 days starting from tomorrow
      for (let i = 1; i <= 30; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dayOfWeek = d.getDay();

        if (!selectedDays.includes(dayOfWeek)) {
          continue;
        }

        const dateStr = d.toISOString().split('T')[0];
        const unitPrice = customPrice && parseFloat(customPrice) > 0 ? customPrice : undefined;

        if (isHourly) {
          const startH = parseInt(startTime.split(':')[0], 10);
          const endH = parseInt(endTime.split(':')[0], 10);
          for (let h = startH; h + slotDurationHours <= endH; h += slotDurationHours) {
            const sTime = `${String(h).padStart(2, '0')}:00`;
            const eTime = `${String(h + slotDurationHours).padStart(2, '0')}:00`;
            unitsToCreate.push({
              date: dateStr,
              start_time: sTime,
              end_time: eTime,
              price: unitPrice,
            });
          }
        } else {
          // half_day or full_day must not have start_time/end_time
          unitsToCreate.push({
            date: dateStr,
            price: unitPrice,
          });
        }
      }

      if (unitsToCreate.length === 0) {
        toast.error('No slots matched the selected days and hours.');
        setIsGenerating(false);
        return;
      }

      // Chunk into batches of 150 (backend limit is 200)
      const BATCH_SIZE = 150;
      let totalCreated = 0;
      for (let i = 0; i < unitsToCreate.length; i += BATCH_SIZE) {
        const batch = unitsToCreate.slice(i, i + BATCH_SIZE);
        const created = await ownerApi.addInventoryUnits(venueId, batch);
        totalCreated += created.length;
      }

      toast.success(`Successfully generated ${totalCreated} bookable slots across the next 30 days!`);
      await fetchExistingSlots();
    } catch (err: any) {
      console.error('Failed to generate inventory:', err);
      toast.error(err?.detail || err?.message || 'Failed to create inventory slots.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold/15 text-pitch text-xs font-bold border border-marigold/30 mb-3">
          <Calendar className="w-3.5 h-3.5 text-pitch" /> Step 7: Availability & Calendar
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">Schedule bookable slots</h2>
        <p className="text-on-surface-variant text-sm">
          Set up inventory units for the next 30 days so prospective customers can immediately book your space once approved.
        </p>
      </div>

      {/* Inventory Status Card */}
      <div className={`p-5 rounded-2xl border ${
        futureSlotsCount > 0
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : 'bg-amber-50/70 border-amber-200 text-amber-950'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              futureSlotsCount > 0 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              {futureSlotsCount > 0 ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                {isLoadingSlots
                  ? 'Checking inventory...'
                  : futureSlotsCount > 0
                  ? `${futureSlotsCount} Future Slots Scheduled`
                  : 'No Bookable Slots Scheduled Yet'}
              </h3>
              <p className="text-xs mt-1 text-on-surface-variant leading-relaxed">
                {futureSlotsCount > 0
                  ? 'Your listing has future bookable slots and meets the inventory requirement for submission.'
                  : 'To submit your listing for review, at least one future available slot is required. Use the generator below to populate slots for the next 30 days.'}
              </p>
            </div>
          </div>
          {venueId && (
            <button
              type="button"
              onClick={fetchExistingSlots}
              disabled={isLoadingSlots}
              className="p-1.5 rounded-lg hover:bg-black/5 text-on-surface-variant transition-colors cursor-pointer"
              title="Refresh inventory count"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingSlots ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Schedule Generator */}
      <div className="bg-chalk p-6 rounded-2xl border border-surface-container-high space-y-6">
        {futureSlotsCount === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-amber-950">Action Needed to Submit Listing</p>
              <p className="text-amber-800 leading-relaxed">
                Click <strong>"Generate 30-Day Available Inventory"</strong> below to create your initial bookable schedule. GroundKart requires at least one bookable date before a venue can be submitted for review.
              </p>
            </div>
          </div>
        )}
        <div>
          <h3 className="font-display font-semibold text-base text-ink mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pitch" /> 30-Day Auto-Scheduler
          </h3>
          <p className="text-xs text-on-surface-variant">
            Select the days and booking windows you want available. We will generate the units automatically.
          </p>
        </div>

        {/* Operating Days */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-ink">Active Days of the Week</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDaysPreset([1, 2, 3, 4, 5, 6, 0])}
                className="text-[11px] font-semibold text-pitch hover:underline cursor-pointer"
              >
                All 7 Days
              </button>
              <span className="text-on-surface-variant/40">|</span>
              <button
                type="button"
                onClick={() => setDaysPreset([1, 2, 3, 4, 5])}
                className="text-[11px] font-semibold text-pitch hover:underline cursor-pointer"
              >
                Weekdays
              </button>
              <span className="text-on-surface-variant/40">|</span>
              <button
                type="button"
                onClick={() => setDaysPreset([6, 0])}
                className="text-[11px] font-semibold text-pitch hover:underline cursor-pointer"
              >
                Weekends
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS_OF_WEEK.map((d) => {
              const isSelected = selectedDays.includes(d.dayNum);
              return (
                <button
                  type="button"
                  key={d.dayNum}
                  onClick={() => toggleDay(d.dayNum)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center cursor-pointer ${
                    isSelected
                      ? 'bg-pitch text-chalk shadow-xs ring-1 ring-pitch'
                      : 'bg-mist text-on-surface-variant hover:text-ink hover:bg-surface-container-highest border border-surface-container'
                  }`}
                >
                  <span className="hidden sm:inline">{d.short}</span>
                  <span className="sm:hidden">{d.short.slice(0, 1)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hourly Options */}
        {isHourly ? (
          <div className="space-y-4 pt-2 border-t border-surface-container">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-pitch" /> First Slot Starts
                </label>
                <select
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                >
                  {Array.from({ length: 24 }).map((_, h) => {
                    const timeVal = `${String(h).padStart(2, '0')}:00`;
                    return (
                      <option key={timeVal} value={timeVal}>
                        {timeVal}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-pitch" /> Last Slot Ends
                </label>
                <select
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                >
                  {Array.from({ length: 24 }).map((_, h) => {
                    const hour = h + 1;
                    const timeVal = hour === 24 ? '23:59' : `${String(hour).padStart(2, '0')}:00`;
                    return (
                      <option key={timeVal} value={timeVal}>
                        {timeVal}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Slot Duration
                </label>
                <select
                  value={slotDurationHours}
                  onChange={(e) => handleSlotDurationChange(parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                >
                  <option value={1}>1 Hour per slot</option>
                  <option value={2}>2 Hours per slot</option>
                  <option value={3}>3 Hours per slot</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-mist border border-surface-container text-xs text-on-surface-variant">
            <p className="font-semibold text-ink mb-1">
              {data.unit_type === 'half_day' ? 'Half-Day Venue Schedule' : 'Full-Day Venue Schedule'}
            </p>
            <p className="leading-relaxed">
              For {data.unit_type === 'half_day' ? 'half-day' : 'full-day'} bookings, the scheduler creates a single full-day bookable unit per active day. Start and end times are not required.
            </p>
          </div>
        )}

        {/* Custom Price Override */}
        <div className="pt-2 border-t border-surface-container">
          <label className="block text-xs font-semibold text-ink mb-1">
            Slot Price Override (Optional)
          </label>
          <div className="relative w-full sm:w-1/2">
            <span className="absolute left-3 top-2.5 text-xs font-bold text-on-surface-variant font-display">₹</span>
            <input
              type="number"
              value={customPrice}
              onChange={(e) => handleCustomPriceChange(e.target.value)}
              placeholder={`Default: ₹${data.base_price || 0}`}
              min={0}
              className="w-full rounded-xl border border-surface-container-highest pl-7 pr-3 py-2 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
            />
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Leave blank to use your base price (₹{data.base_price || 0} / {data.unit_type || 'hour'}).
          </p>
        </div>

        {/* Generate Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleGenerateInventory}
            disabled={isGenerating || !venueId}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer ${
              isGenerating || !venueId
                ? 'bg-surface-container-highest text-on-surface-variant/50 cursor-not-allowed'
                : 'bg-pitch hover:bg-ink text-chalk active:scale-[0.99]'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating schedule for next 30 days...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{futureSlotsCount > 0 ? 'Generate Additional 30-Day Slots' : 'Generate 30-Day Available Inventory'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
