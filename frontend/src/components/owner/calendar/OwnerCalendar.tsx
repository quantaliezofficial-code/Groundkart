import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ownerApi } from '../../../lib/api/owner';
import { ApiVenue, ApiBookingDetail } from '../../../lib/api/types';
import GroundSelect from '../../ui/GroundSelect';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface OwnerCalendarProps {
  venues: ApiVenue[];
  bookings: ApiBookingDetail[];
  isLoading: boolean;
}

export default function OwnerCalendar({ venues, bookings, isLoading }: OwnerCalendarProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Fetch Inventory Units and Blocks for the selected venue if not 'all'
  const { data: inventory = [] } = useQuery({
    queryKey: ['owner-inventory', selectedVenueId],
    queryFn: () => ownerApi.listInventoryUnits(selectedVenueId),
    enabled: selectedVenueId !== 'all',
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ['owner-blocks', selectedVenueId],
    queryFn: () => ownerApi.listBlocks(selectedVenueId),
    enabled: selectedVenueId !== 'all',
  });

  const filteredBookings = useMemo(() => 
    selectedVenueId === 'all' ? bookings : bookings.filter(b => b.venue_id === selectedVenueId),
  [bookings, selectedVenueId]);

  // Aggregate by day
  const dayData = useMemo(() => {
    const data: Record<string, { bookings: number; available: number; blocked: boolean }> = {};
    for (const b of filteredBookings) {
      if (b.status === 'confirmed' || b.status === 'completed') {
        if (!data[b.slot_date]) data[b.slot_date] = { bookings: 0, available: 0, blocked: false };
        data[b.slot_date].bookings++;
      }
    }
    for (const unit of inventory) {
      if (unit.status === 'available') {
        if (!data[unit.date]) data[unit.date] = { bookings: 0, available: 0, blocked: false };
        data[unit.date].available++;
      }
    }
    // Map maintenance blocks to calendar days using start_time (not start_date —
    // the backend BlockResponse schema uses start_time: datetime, not start_date: date).
    for (const block of blocks) {
      if (block.status === 'active' && block.start_time) {
        const blockDate = block.start_time.slice(0, 10); // Extract YYYY-MM-DD
        if (!data[blockDate]) data[blockDate] = { bookings: 0, available: 0, blocked: false };
        data[blockDate].blocked = true;
      }
    }
    return data;
  }, [filteredBookings, inventory, blocks]);

  const selectedDayBookings = selectedDate ? filteredBookings.filter(b => b.slot_date === selectedDate) : [];
  const selectedDayInventory = selectedDate ? inventory.filter(u => u.date === selectedDate) : [];
  const isSelectedDayBlocked = selectedDate ? (dayData[selectedDate]?.blocked ?? false) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <GroundSelect
          value={selectedVenueId}
          onValueChange={setSelectedVenueId}
          options={[{ value: 'all', label: 'All venues' }, ...venues.map((v) => ({ value: v.id, label: v.name }))]}
          triggerClassName="w-full sm:w-[200px]"
        />
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setMonthCursor(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-mist cursor-pointer">
            <ChevronLeft size={18} />
          </button>
          <span className="font-sans text-sm font-bold text-ink w-32 text-center">
            {monthCursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setMonthCursor(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-mist cursor-pointer">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="shimmer h-96 rounded-2xl" />
      ) : (
        <div className="bg-chalk border border-ink/10 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink/40 mb-2 uppercase">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const data = dayData[dateStr] || { bookings: 0, available: 0, blocked: false };
              const isSelected = selectedDate === dateStr;
              
              let bgColor = 'hover:bg-mist text-on-surface-variant';
              if (isSelected) bgColor = 'bg-pitch text-chalk shadow-md';
              else if (data.blocked) bgColor = 'bg-surface-container-highest opacity-50 cursor-not-allowed';
              else if (data.bookings > 0) bgColor = 'bg-emerald-100 text-emerald-900 font-semibold border-b-2 border-emerald-500';
              else if (data.available > 0) bgColor = 'bg-primary-container/10 text-ink hover:bg-primary-container/20';

              return (
                <button
                  key={day}
                  onClick={() => !data.blocked && setSelectedDate(isSelected ? null : dateStr)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 text-sm transition-all duration-200 ${bgColor}`}
                >
                  <span>{day}</span>
                  <div className="flex gap-0.5">
                    {data.bookings > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={`${data.bookings} Bookings`} />}
                    {data.available > 0 && <span className="w-1.5 h-1.5 rounded-full bg-pitch" title={`${data.available} Available`} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedDate && (
        <div className="bg-chalk border border-ink/10 rounded-2xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-ink mb-4 flex items-center justify-between">
            <span>{new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            {isSelectedDayBlocked && <span className="text-xs bg-error/10 text-error px-2 py-1 rounded-full uppercase tracking-widest font-bold">Blocked</span>}
          </h3>
          
          <div className="space-y-4">
            {selectedDayBookings.length > 0 ? (
              <div>
                <h4 className="text-xs font-bold text-ink/50 uppercase tracking-wider mb-3">Confirmed Bookings</h4>
                <div className="space-y-3">
                  {selectedDayBookings.map(b => (
                    <div key={b.id} className="flex justify-between items-center p-4 bg-mist rounded-xl border border-surface-container-highest">
                      <div>
                        <p className="font-semibold text-ink">{b.venue_name}</p>
                        <p className="text-xs text-on-surface-variant font-mono mt-1">
                          {b.slot_start_time ? `${b.slot_start_time.slice(0, 5)} - ${b.slot_end_time?.slice(0, 5)}` : 'Full Day'}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-pitch">₹{b.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedDayInventory.length > 0 ? (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-ink/50 uppercase tracking-wider mb-3">Available Slots</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedDayInventory.map(u => (
                    <span key={u.id} className="px-3 py-1.5 bg-primary-container/10 text-pitch border border-primary-container/20 rounded-lg text-sm font-medium">
                      {u.start_time ? `${u.start_time.slice(0, 5)} - ${u.end_time?.slice(0, 5)}` : 'Full Day'}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              selectedDayBookings.length === 0 && !isSelectedDayBlocked && (
                <p className="text-sm text-on-surface-variant italic">No activity scheduled for this day.</p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
