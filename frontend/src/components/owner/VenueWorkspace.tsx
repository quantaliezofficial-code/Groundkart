import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CircleDollarSign,
  Target,
  Image as ImageIcon,
  FileText,
  Star,
  Settings,
  Pause,
  Play,
  Archive,
  Edit3,
  Loader2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MapPin,
  TrendingUp,
  Tag,
  ShieldAlert,
  Sparkles,
  Save,
  Check,
} from 'lucide-react';
import { ownerApi } from '../../lib/api/owner';
import { venuesApi } from '../../lib/api/venues';
import { ApiError } from '../../lib/api/client';
import type { ApiVenue, ApiBookingDetail, VenueRentalOption, VenuePurpose, UnitType, VenueUpdateRequest } from '../../lib/api/types';
import { useOwnerVenueStats, useOwnerBookings } from '../../hooks/useOwner';
import { useToast } from '../ui/Toast';
import { StatusBadge, SafeImage } from '../dashboard';
import OwnerCalendar from './calendar/OwnerCalendar';
import MediaStep from './listing-builder/MediaStep';
import PresentationStep from './listing-builder/PresentationStep';
import RentalSetupStep from './listing-builder/RentalSetupStep';
import PurposeDetailsStep from './listing-builder/PurposeDetailsStep';
import FeaturesStep from './listing-builder/FeaturesStep';

interface VenueWorkspaceProps {
  venue: ApiVenue;
  onClose: () => void;
  onOpenListingBuilder: (venueId: string) => void;
}

type WorkspaceTab =
  | 'Overview'
  | 'Details'
  | 'Amenities'
  | 'Calendar'
  | 'Bookings'
  | 'Rental & Pricing'
  | 'Purposes'
  | 'Photos & Videos'
  | 'Description'
  | 'Reviews'
  | 'Settings';

export default function VenueWorkspace({
  venue,
  onClose,
  onOpenListingBuilder,
}: VenueWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Overview');
  const [currentVenue, setCurrentVenue] = useState<ApiVenue>(venue);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useOwnerVenueStats(venue.id);
  const { data: allBookings = [] } = useOwnerBookings({ venue_id: venue.id });
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['venue-workspace-reviews', venue.id],
    queryFn: () => venuesApi.getReviews(venue.id),
  });

  // Details Form State
  const [detailsForm, setDetailsForm] = useState({
    name: venue.name || '',
    display_name: venue.display_name || '',
    tagline: venue.tagline || '',
    category: venue.category || '',
    capacity: venue.capacity ? String(venue.capacity) : '',
    address: venue.address || '',
    city: venue.city || '',
    state: venue.state || '',
    pincode: venue.pincode || '',
    description: venue.description || '',
  });
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Amenities State
  const [amenitiesList, setAmenitiesList] = useState<string[]>(venue.amenities || []);
  const [isSavingAmenities, setIsSavingAmenities] = useState(false);

  // Sync state on currentVenue change
  useEffect(() => {
    setDetailsForm({
      name: currentVenue.name || '',
      display_name: currentVenue.display_name || '',
      tagline: currentVenue.tagline || '',
      category: currentVenue.category || '',
      capacity: currentVenue.capacity ? String(currentVenue.capacity) : '',
      address: currentVenue.address || '',
      city: currentVenue.city || '',
      state: currentVenue.state || '',
      pincode: currentVenue.pincode || '',
      description: currentVenue.description || '',
    });
    setAmenitiesList(currentVenue.amenities || []);
  }, [currentVenue]);

  // Keep venue up-to-date
  const refreshVenue = async () => {
    try {
      const refreshed = await ownerApi.getVenue(venue.id);
      setCurrentVenue(refreshed);
      queryClient.invalidateQueries({ queryKey: ['owner-venues'] });
    } catch (e) {
      console.error('Failed to refresh venue', e);
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'suspended' | 'archived') => {
    setIsUpdatingStatus(true);
    try {
      await ownerApi.updateVenue(venue.id, { status: newStatus } as any);
      toast.success(
        newStatus === 'active'
          ? 'Venue is now live and accepting bookings'
          : newStatus === 'suspended'
          ? 'Venue listing paused'
          : 'Venue archived'
      );
      await refreshVenue();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.detail : err?.message || 'Failed to update status';
      toast.error(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!detailsForm.name.trim()) {
      toast.error('Venue name is required');
      return;
    }
    if (!detailsForm.address.trim()) {
      toast.error('Address is required');
      return;
    }
    if (!detailsForm.city.trim()) {
      toast.error('City is required');
      return;
    }

    setIsSavingDetails(true);
    try {
      const payload: VenueUpdateRequest = {
        name: detailsForm.name.trim(),
        display_name: detailsForm.display_name.trim() || undefined,
        tagline: detailsForm.tagline.trim() || undefined,
        category: detailsForm.category.trim() || undefined,
        capacity: detailsForm.capacity ? parseInt(detailsForm.capacity, 10) : undefined,
        address: detailsForm.address.trim(),
        city: detailsForm.city.trim(),
        state: detailsForm.state.trim() || undefined,
        pincode: detailsForm.pincode.trim() || undefined,
        description: detailsForm.description.trim() || undefined,
      };
      await ownerApi.updateVenue(currentVenue.id, payload);
      toast.success('Space details updated successfully');
      await refreshVenue();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.detail : err?.message || 'Failed to update space details';
      toast.error(msg);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSaveAmenities = async (newList?: string[]) => {
    const toSave = newList ?? amenitiesList;
    setIsSavingAmenities(true);
    try {
      await ownerApi.updateVenue(currentVenue.id, { amenity_names: toSave });
      toast.success('Amenities updated successfully');
      await refreshVenue();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.detail : err?.message || 'Failed to update amenities';
      toast.error(msg);
    } finally {
      setIsSavingAmenities(false);
    }
  };

  const tabs: { id: WorkspaceTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'Overview', label: 'Overview', icon: TrendingUp },
    { id: 'Details', label: 'Space Details', icon: Building2 },
    { id: 'Amenities', label: 'Amenities', icon: Sparkles },
    { id: 'Calendar', label: 'Calendar', icon: Calendar },
    { id: 'Bookings', label: 'Bookings', icon: Clock },
    { id: 'Rental & Pricing', label: 'Rental & Pricing', icon: CircleDollarSign },
    { id: 'Purposes', label: 'Purposes', icon: Target },
    { id: 'Photos & Videos', label: 'Photos & Videos', icon: ImageIcon },
    { id: 'Description', label: 'Description', icon: FileText },
    { id: 'Reviews', label: 'Reviews', icon: Star },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  const coverMedia = (currentVenue.media || []).find((m) => m.is_cover) || (currentVenue.media || [])[0];

  return (
    <div className="fixed inset-0 z-50 bg-background-mist flex flex-col font-sans overflow-hidden" data-lenis-prevent>
      {/* Top Header */}
      <header className="bg-chalk border-b border-surface-container-high px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-mist rounded-xl transition-colors text-on-surface-variant hover:text-ink cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <div className="h-6 w-px bg-surface-container hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-mist shrink-0 border border-surface-container">
              {coverMedia ? (
                <SafeImage src={coverMedia.url} alt={currentVenue.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                  <Building2 size={20} />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-lg text-ink">{currentVenue.name}</h1>
                <StatusBadge status={currentVenue.status} />
              </div>
              <p className="text-xs text-on-surface-variant flex items-center gap-1">
                <MapPin size={12} /> {currentVenue.city}, {currentVenue.state || 'India'} • ₹{currentVenue.base_price}/{currentVenue.unit_type}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {currentVenue.status === 'active' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              disabled={isUpdatingStatus}
              className="px-3.5 py-1.5 rounded-xl border border-surface-container text-xs font-semibold text-on-surface-variant hover:bg-mist hover:text-ink transition flex items-center gap-1.5 cursor-pointer"
            >
              <Pause size={13} /> Pause Listing
            </button>
          )}
          {currentVenue.status === 'suspended' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={isUpdatingStatus}
              className="px-3.5 py-1.5 rounded-xl bg-pitch text-chalk text-xs font-semibold hover:bg-ink transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play size={13} /> Resume Listing
            </button>
          )}
          <button
            onClick={() => onOpenListingBuilder(venue.id)}
            className="px-4 py-1.5 rounded-xl bg-pitch text-chalk text-xs font-semibold hover:bg-ink transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Edit3 size={13} /> Edit in Builder
          </button>
        </div>
      </header>

      {/* Navigation Sub-Tabs */}
      <nav className="bg-chalk border-b border-surface-container-high px-6 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-pitch text-pitch'
                  : 'border-transparent text-on-surface-variant hover:text-ink hover:border-surface-container'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Tab Workspace Content */}
      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar overscroll-contain" data-lenis-prevent>
        <div className="max-w-7xl mx-auto space-y-6">

          {/* 1. Overview Tab */}
          {activeTab === 'Overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-chalk p-5 rounded-2xl border border-surface-container shadow-xs">
                  <p className="text-xs text-on-surface-variant font-medium">30-Day Revenue</p>
                  <p className="font-display text-2xl font-bold text-ink mt-1">
                    ₹{Number(stats?.revenue_last_30_days ?? stats?.revenue_30d ?? 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-chalk p-5 rounded-2xl border border-surface-container shadow-xs">
                  <p className="text-xs text-on-surface-variant font-medium">Upcoming Events</p>
                  <p className="font-display text-2xl font-bold text-ink mt-1">
                    {stats?.events_upcoming ?? stats?.upcoming_events_count ?? 0}
                  </p>
                </div>
                <div className="bg-chalk p-5 rounded-2xl border border-surface-container shadow-xs">
                  <p className="text-xs text-on-surface-variant font-medium">Total Bookings</p>
                  <p className="font-display text-2xl font-bold text-ink mt-1">
                    {stats?.recent_bookings_count ?? stats?.total_bookings_count ?? allBookings.length}
                  </p>
                </div>
                <div className="bg-chalk p-5 rounded-2xl border border-surface-container shadow-xs">
                  <p className="text-xs text-on-surface-variant font-medium">Average Rating</p>
                  <p className="font-display text-2xl font-bold text-marigold mt-1 flex items-center gap-1.5">
                    <Star size={18} className="fill-marigold" />
                    {Number(currentVenue.avg_rating || stats?.avg_rating || 0).toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Rental Options & Purposes Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-bold text-sm text-ink flex items-center gap-2">
                      <CircleDollarSign size={16} className="text-pitch" /> Active Rental Modes
                    </h3>
                    <button
                      onClick={() => setActiveTab('Rental & Pricing')}
                      className="text-xs text-pitch font-semibold hover:underline cursor-pointer"
                    >
                      Manage Modes
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(currentVenue.rental_options || []).length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">Defaulting to ₹{currentVenue.base_price}/{currentVenue.unit_type}</p>
                    ) : (
                      currentVenue.rental_options?.map((ro, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-mist/60 text-xs">
                          <span className="font-semibold capitalize text-ink">{ro.mode.replace('_', ' ')}</span>
                          <span className="font-mono text-pitch font-bold">₹{ro.price}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-bold text-sm text-ink flex items-center gap-2">
                      <Target size={16} className="text-pitch" /> Configured Purposes
                    </h3>
                    <button
                      onClick={() => setActiveTab('Purposes')}
                      className="text-xs text-pitch font-semibold hover:underline cursor-pointer"
                    >
                      Manage Purposes
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(currentVenue.purposes || []).length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic">No specific purposes configured yet</p>
                    ) : (
                      currentVenue.purposes?.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-mist/60 text-xs">
                          <div>
                            <span className="font-semibold text-ink">{p.name || p.custom_name}</span>
                            <span className="text-2xs text-on-surface-variant ml-2">
                              {p.max_guests ? `Up to ${p.max_guests} guests` : 'Standard capacity'}
                            </span>
                          </div>
                          {p.custom_name && !p.is_custom_approved && (
                            <span className="px-2 py-0.5 rounded-full text-2xs bg-amber-100 text-amber-800 font-semibold">
                              Pending Review
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Features & Amenities and Space Info Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Features & Amenities Card */}
                <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-bold text-sm text-ink flex items-center gap-2">
                      <Sparkles size={16} className="text-pitch" /> Features & Amenities
                    </h3>
                    <button
                      onClick={() => setActiveTab('Amenities')}
                      className="text-xs text-pitch font-semibold hover:underline cursor-pointer"
                    >
                      Manage Amenities
                    </button>
                  </div>
                  {(currentVenue.amenities || []).length === 0 ? (
                    <div className="p-4 rounded-xl bg-mist/60 text-center space-y-2">
                      <p className="text-xs text-on-surface-variant italic">
                        No amenities configured yet. Add facilities like Wi-Fi, Parking, or AC to attract more bookings.
                      </p>
                      <button
                        onClick={() => setActiveTab('Amenities')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pitch text-chalk text-xs font-semibold hover:bg-ink transition cursor-pointer"
                      >
                        <Sparkles size={12} /> Add Amenities
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {currentVenue.amenities.map((am, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-mist border border-surface-container text-xs font-medium text-ink"
                          >
                            <Check size={11} className="text-pitch" /> {am}
                          </span>
                        ))}
                      </div>
                      <p className="text-2xs text-on-surface-variant">
                        {currentVenue.amenities.length} amenities active on your public profile.
                      </p>
                    </div>
                  )}
                </div>

                {/* Space & Location Info Card */}
                <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-bold text-sm text-ink flex items-center gap-2">
                      <Building2 size={16} className="text-pitch" /> Space & Location Info
                    </h3>
                    <button
                      onClick={() => setActiveTab('Details')}
                      className="text-xs text-pitch font-semibold hover:underline cursor-pointer"
                    >
                      Edit Details
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-mist/60 space-y-0.5">
                      <span className="text-2xs text-on-surface-variant font-medium">Category</span>
                      <p className="font-semibold text-ink truncate capitalize">
                        {currentVenue.category ? currentVenue.category.replace('_', ' ') : 'General Space'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-mist/60 space-y-0.5">
                      <span className="text-2xs text-on-surface-variant font-medium">Max Capacity</span>
                      <p className="font-semibold text-ink">
                        {currentVenue.capacity ? `${currentVenue.capacity} guests/players` : 'Not specified'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-mist/60 space-y-0.5 col-span-2">
                      <span className="text-2xs text-on-surface-variant font-medium">Address & City</span>
                      <p className="font-semibold text-ink truncate">
                        {currentVenue.address}, {currentVenue.city}{currentVenue.state ? `, ${currentVenue.state}` : ''}{currentVenue.pincode ? ` - ${currentVenue.pincode}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Bookings List */}
              <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-sans font-bold text-sm text-ink">Recent Venue Reservations</h3>
                  <button
                    onClick={() => setActiveTab('Bookings')}
                    className="text-xs text-pitch font-semibold hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>
                {allBookings.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic py-4 text-center">
                    No bookings recorded for this venue yet.
                  </p>
                ) : (
                  <div className="divide-y divide-surface-container">
                    {allBookings.slice(0, 5).map((b) => (
                      <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-ink">
                            {b.slot_date} • {b.slot_start_time ? `${b.slot_start_time.slice(0, 5)} - ${b.slot_end_time?.slice(0, 5) || ''}` : 'Full Day'}
                          </p>
                          <p className="text-2xs text-on-surface-variant mt-0.5">
                            Customer: {b.customer_name || b.guest_name || 'Guest'} {b.purpose_name ? `• ${b.purpose_name}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-ink">₹{b.amount}</p>
                          <span className="inline-block mt-0.5 capitalize text-2xs text-on-surface-variant font-medium">
                            {b.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'Details' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-container">
                <div>
                  <h3 className="font-display font-bold text-base text-ink">Space Details & Location</h3>
                  <p className="text-xs text-on-surface-variant">
                    Update core venue information, address, occupancy limit, and public branding.
                  </p>
                </div>
                <button
                  onClick={() => handleSaveDetails()}
                  disabled={isSavingDetails}
                  className="px-4 py-2 rounded-xl bg-pitch text-chalk text-xs font-semibold hover:bg-ink transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingDetails ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Space Details
                </button>
              </div>

              <form onSubmit={handleSaveDetails} className="space-y-6">
                {/* Section 1: Basic Identity */}
                <div>
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Space Identity & Branding</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Venue Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={detailsForm.name}
                        onChange={(e) => setDetailsForm({ ...detailsForm, name: e.target.value })}
                        required
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="e.g. Grand Eden Lawn"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Display / Brand Name
                      </label>
                      <input
                        type="text"
                        value={detailsForm.display_name}
                        onChange={(e) => setDetailsForm({ ...detailsForm, display_name: e.target.value })}
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="Public-facing name (optional)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Tagline / Catchphrase
                      </label>
                      <input
                        type="text"
                        value={detailsForm.tagline}
                        onChange={(e) => setDetailsForm({ ...detailsForm, tagline: e.target.value })}
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="e.g. Premier floodlit turf and pavilion"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Category / Venue Type
                      </label>
                      <input
                        type="text"
                        value={detailsForm.category}
                        onChange={(e) => setDetailsForm({ ...detailsForm, category: e.target.value })}
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="e.g. Sports Ground, Banquet Hall, Studio"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1.5">
                        <Users size={12} className="text-pitch" /> Maximum Capacity (Guests / Players)
                      </label>
                      <input
                        type="number"
                        value={detailsForm.capacity}
                        onChange={(e) => setDetailsForm({ ...detailsForm, capacity: e.target.value })}
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="e.g. 250"
                        min={1}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Location & Address */}
                <div className="pt-4 border-t border-surface-container">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Location & Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Street Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={detailsForm.address}
                        onChange={(e) => setDetailsForm({ ...detailsForm, address: e.target.value })}
                        required
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="e.g. Plot 14, Main Stadium Road"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        City <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={detailsForm.city}
                        onChange={(e) => setDetailsForm({ ...detailsForm, city: e.target.value })}
                        required
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="e.g. Mumbai"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        State / Province
                      </label>
                      <input
                        type="text"
                        value={detailsForm.state}
                        onChange={(e) => setDetailsForm({ ...detailsForm, state: e.target.value })}
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="e.g. Maharashtra"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Postal Code / Pincode
                      </label>
                      <input
                        type="text"
                        value={detailsForm.pincode}
                        onChange={(e) => setDetailsForm({ ...detailsForm, pincode: e.target.value })}
                        className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                        placeholder="e.g. 400001"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Description */}
                <div className="pt-4 border-t border-surface-container">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Venue Overview</h4>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Short Description / Bio
                    </label>
                    <textarea
                      rows={3}
                      value={detailsForm.description}
                      onChange={(e) => setDetailsForm({ ...detailsForm, description: e.target.value })}
                      className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2.5 text-xs bg-chalk text-ink focus:outline-none focus:ring-2 focus:ring-pitch leading-relaxed"
                      placeholder="Describe what makes your venue stand out..."
                    />
                  </div>
                </div>

                {/* Footer Save Button */}
                <div className="pt-4 border-t border-surface-container flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingDetails}
                    className="px-5 py-2.5 rounded-xl bg-pitch text-chalk text-xs font-semibold hover:bg-ink transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSavingDetails ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Space Details
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Amenities Tab */}
          {activeTab === 'Amenities' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-container">
                <div>
                  <h3 className="font-display font-bold text-base text-ink">Venue Amenities & Equipment</h3>
                  <p className="text-xs text-on-surface-variant">
                    Configure the features, comfort items, and audio-visual or sports gear available at your venue.
                  </p>
                </div>
                <button
                  onClick={() => handleSaveAmenities()}
                  disabled={isSavingAmenities}
                  className="px-4 py-2 rounded-xl bg-pitch text-chalk text-xs font-semibold hover:bg-ink transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingAmenities ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Amenities ({amenitiesList.length})
                </button>
              </div>

              <FeaturesStep
                venueId={currentVenue.id}
                hideStepBadge={true}
                data={{
                  amenity_names: amenitiesList,
                  capacity: currentVenue.capacity,
                }}
                update={(patch) => {
                  if (patch.amenity_names !== undefined) {
                    setAmenitiesList(patch.amenity_names);
                  }
                  if (patch.capacity !== undefined) {
                    ownerApi.updateVenue(currentVenue.id, { capacity: patch.capacity }).then(refreshVenue).catch(() => {});
                  }
                }}
              />

              <div className="pt-4 border-t border-surface-container flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">
                  {amenitiesList.length} total amenities selected
                </span>
                <button
                  onClick={() => handleSaveAmenities()}
                  disabled={isSavingAmenities}
                  className="px-5 py-2.5 rounded-xl bg-pitch text-chalk text-xs font-semibold hover:bg-ink transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingAmenities ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Amenities ({amenitiesList.length})
                </button>
              </div>
            </div>
          )}

          {/* 2. Calendar Tab */}
          {activeTab === 'Calendar' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container">
              <OwnerCalendar venues={[currentVenue]} bookings={allBookings} isLoading={false} />
            </div>
          )}

          {/* 3. Bookings Tab */}
          {activeTab === 'Bookings' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-4">
              <h3 className="font-display font-bold text-base text-ink">Venue Reservation History</h3>
              {allBookings.length === 0 ? (
                <p className="text-sm text-on-surface-variant italic py-8 text-center">
                  No bookings found for this venue.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-surface-container text-on-surface-variant font-semibold">
                        <th className="pb-3">Date & Slot</th>
                        <th className="pb-3">Customer</th>
                        <th className="pb-3">Purpose & Mode</th>
                        <th className="pb-3">Guests</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {allBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-mist/40 transition">
                          <td className="py-3 font-semibold text-ink">
                            {b.slot_date}
                            <span className="block text-2xs font-normal text-on-surface-variant">
                              {b.slot_start_time ? `${b.slot_start_time.slice(0, 5)} - ${b.slot_end_time?.slice(0, 5) || ''}` : 'Full Day'}
                            </span>
                          </td>
                          <td className="py-3 text-ink">
                            {b.customer_name || b.guest_name || 'Guest'}
                            <span className="block text-2xs text-on-surface-variant">{b.user_email || '—'}</span>
                          </td>
                          <td className="py-3 text-ink">
                            {b.purpose_name || 'Standard'}
                            <span className="block text-2xs capitalize text-on-surface-variant">
                              {b.rental_mode || currentVenue.unit_type}
                            </span>
                          </td>
                          <td className="py-3 text-ink">{b.guest_count || '—'}</td>
                          <td className="py-3 font-mono font-bold text-ink">₹{b.amount}</td>
                          <td className="py-3">
                            <span className="px-2.5 py-1 rounded-full text-2xs font-semibold capitalize bg-mist text-ink border border-surface-container">
                              {b.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. Rental & Pricing Tab */}
          {activeTab === 'Rental & Pricing' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container">
              <RentalSetupStep
                venueId={currentVenue.id}
                data={{
                  base_price: String(currentVenue.base_price),
                  unit_type: currentVenue.unit_type,
                }}
                update={async (patch) => {
                  if (patch.base_price || patch.unit_type) {
                    await refreshVenue();
                  }
                }}
              />
            </div>
          )}

          {/* 5. Purposes Tab */}
          {activeTab === 'Purposes' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container">
              <PurposeDetailsStep
                venueId={currentVenue.id}
                data={{
                  capacity: currentVenue.capacity,
                  use_case_ids: currentVenue.use_cases?.map((uc: any) => uc.id) || [],
                }}
                update={() => refreshVenue()}
              />
            </div>
          )}

          {/* 6. Photos & Videos Tab */}
          {activeTab === 'Photos & Videos' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container">
              <MediaStep
                venueId={currentVenue.id}
                onComplete={() => refreshVenue()}
                onPhotoCountChange={() => {}}
              />
            </div>
          )}

          {/* 7. Description Tab */}
          {activeTab === 'Description' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container">
              <PresentationStep
                venueId={currentVenue.id}
                data={{ content_blocks: currentVenue.content_blocks || [] }}
                update={async (patch) => {
                  if (patch.content_blocks) {
                    await ownerApi.updateVenue(currentVenue.id, { content_blocks: patch.content_blocks } as any);
                    await refreshVenue();
                  }
                }}
              />
            </div>
          )}

          {/* 8. Reviews Tab */}
          {activeTab === 'Reviews' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-4">
              <h3 className="font-display font-bold text-base text-ink">Customer Reviews</h3>
              {reviews.length === 0 ? (
                <p className="text-sm text-on-surface-variant italic py-8 text-center">
                  No customer reviews yet for this venue.
                </p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="p-4 rounded-xl border border-surface-container bg-mist/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-ink">{rev.user_name || 'Guest'}</span>
                        <div className="flex text-marigold">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              className={i < rev.rating ? 'fill-marigold text-marigold' : 'text-ink/20'}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed">{rev.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 9. Settings Tab */}
          {activeTab === 'Settings' && (
            <div className="bg-chalk p-6 rounded-2xl border border-surface-container space-y-6">
              <div>
                <h3 className="font-display font-bold text-base text-ink mb-1">Listing Controls</h3>
                <p className="text-xs text-on-surface-variant">
                  Manage the public visibility, state, and lifecycle of this venue.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-surface-container space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-ink">Pause / Resume Listing</p>
                    <p className="text-2xs text-on-surface-variant mt-0.5">
                      Paused listings are hidden from search and cannot receive new bookings.
                    </p>
                  </div>
                  {currentVenue.status === 'active' ? (
                    <button
                      onClick={() => handleStatusChange('suspended')}
                      disabled={isUpdatingStatus}
                      className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition cursor-pointer"
                    >
                      Pause Listing
                    </button>
                  ) : currentVenue.status === 'suspended' ? (
                    <button
                      onClick={() => handleStatusChange('active')}
                      disabled={isUpdatingStatus}
                      className="px-4 py-2 rounded-xl bg-pitch text-chalk text-xs font-semibold hover:bg-ink transition cursor-pointer"
                    >
                      Make Live
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-rose-900">Archive Listing</p>
                    <p className="text-2xs text-rose-800 mt-0.5">
                      Permanently retire this venue from operations and booking schedules.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to archive this venue? This action cannot be easily undone.')) {
                        handleStatusChange('archived');
                      }
                    }}
                    disabled={isUpdatingStatus || (currentVenue.status as string) === 'archived'}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-chalk text-xs font-semibold hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
                  >
                    Archive Venue
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
