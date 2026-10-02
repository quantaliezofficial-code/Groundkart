import GroundSelect from './ui/GroundSelect';
import { AlertCircle, Calendar, CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import {
  useAddInventoryUnits,
  useCreateVenue,
  useOwnerInventory,
  useUpdateVenue,
  useUploadVenueImage,
} from '../hooks/useOwner';
import { ApiError } from '../lib/api/client';
import type { ApiVenue, InventoryUnitCreateRequest, UnitType, VenueCreateRequest } from '../lib/api/types';

// ── Category options ──────────────────────────────────────────────────────
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'sports', label: 'Sports Turf / Court' },
  { value: 'banquet_hall', label: 'Banquet Hall' },
  { value: 'farmhouse', label: 'Farmhouse' },
  { value: 'corporate', label: 'Corporate Space' },
  { value: 'community_hall', label: 'Community Hall' },
];

const UNIT_TYPE_OPTIONS: { value: UnitType; label: string }[] = [
  { value: 'hour', label: 'Per hour' },
  { value: 'half_day', label: 'Per half-day' },
  { value: 'full_day', label: 'Per full day' },
];

// ── Category-specific amenity presets ────────────────────────────────────
// Each category gets a curated set of relevant amenities shown as checkboxes.
// "Other" free-text lets owners add anything outside the preset list.
const CATEGORY_AMENITIES: Record<string, string[]> = {
  sports: ['Stadium Lighting', 'Locker Rooms', 'FIFA Certified Turf', 'Flood Lights', 'Free Parking', 'Changing Rooms', 'Spectator Stands', 'First Aid Station'],
  banquet_hall: ['Air Conditioning', 'Stage / Podium', 'Catering Kitchen', 'Sound System', 'Projector & Screen', 'Valet Parking', 'Bridal Suite', 'Outdoor Lawn'],
  farmhouse: ['Swimming Pool', 'BBQ / Grill Area', 'Outdoor Lawn', 'Air Conditioning', 'Free Parking', 'Private Security', 'Gazebo', 'Open Bar Setup'],
  corporate: ['High-Speed WiFi', 'Projector & Screen', 'Whiteboard', 'Air Conditioning', 'Video Conferencing', 'Ergonomic Seating', 'Breakout Rooms', 'Reception Desk'],
  community_hall: ['Air Conditioning', 'Sound System', 'Free Parking', 'Stage / Podium', 'Kitchen Access', 'Accessible Entry', 'Storage Room', 'Tables & Chairs'],
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

interface OwnerVenueModalProps {
  /** null = create mode. An existing venue = edit mode. */
  venue: ApiVenue | null;
  onClose: () => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  return 'Something went wrong. Please try again.';
}

// ── Step indicator ────────────────────────────────────────────────────────
function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono transition ${
                i < current
                  ? 'bg-pitch text-chalk'
                  : i === current
                    ? 'bg-marigold text-ink'
                    : 'bg-mist text-on-surface-variant border border-ink/10'
              } ease-out`}
            >
              {i < current ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-[10px] mt-1 font-sans font-semibold whitespace-nowrap ${i === current ? 'text-pitch' : 'text-on-surface-variant'}`}>
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`h-px w-8 mx-1 mt-[-12px] transition ${i < current ? 'bg-pitch' : 'bg-ink/10'} ease-out`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────
export default function OwnerVenueModal({ venue, onClose }: OwnerVenueModalProps) {
  const [savedVenue, setSavedVenue] = useState<ApiVenue | null>(venue);

  // Step state — only relevant for create mode; edit mode goes straight to
  // the full form since the venue is already saved
  const [step, setStep] = useState(0);
  const STEP_LABELS = ['Basics', 'Location', 'Amenities'];
  const TOTAL_STEPS = 3;

  // ── Step 1: Basics fields ──────────────────────────────────────────────
  const [name, setName] = useState(venue?.name ?? '');
  const [category, setCategory] = useState(venue?.category ?? 'sports');
  const [unitType, setUnitType] = useState<UnitType>(venue?.unit_type ?? 'hour');
  const [basePrice, setBasePrice] = useState(venue?.base_price ?? '');
  const [capacity, setCapacity] = useState(venue?.capacity != null ? String(venue.capacity) : '');
  const [description, setDescription] = useState(venue?.description ?? '');

  // ── Step 2: Location fields ────────────────────────────────────────────
  const [address, setAddress] = useState(venue?.address ?? '');
  const [city, setCity] = useState(venue?.city ?? '');
  const [stateField, setStateField] = useState(venue?.state ?? '');
  const [pincode, setPincode] = useState(venue?.pincode ?? '');

  // ── Step 3: Amenities ─────────────────────────────────────────────────
  // Pre-check amenities that the venue already has (edit mode)
  const existingAmenities = new Set(venue?.amenities ?? []);
  const [checkedAmenities, setCheckedAmenities] = useState<Set<string>>(existingAmenities);
  const [otherAmenities, setOtherAmenities] = useState('');

  const toggleAmenity = (name: string) => {
    setCheckedAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Preset list for current category
  const presetAmenities = CATEGORY_AMENITIES[category] ?? [];

  // ── Save state ────────────────────────────────────────────────────────
  const [basicsError, setBasicsError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // Guard against double-invocation (React Strict Mode double-effects or
  // rapid double-clicks) — a second call while one is already in-flight
  // is silently dropped rather than causing a stale error to appear.
  const isSubmittingRef = useRef(false);

  const createVenue = useCreateVenue();
  const updateVenue = useUpdateVenue();
  const saving = createVenue.isPending || updateVenue.isPending;

  // Aggressively clear error and "just saved" banner whenever the modal
  // transitions from create-wizard mode to edit mode (i.e. the moment
  // savedVenue goes from null -> a real venue). Without this, a stale
  // basicsError from a previously failed attempt or a React Strict Mode
  // double-fire can survive the transition and show as a false error on the
  // freshly-rendered edit form.
  const prevSavedVenueRef = useRef(savedVenue);
  useEffect(() => {
    const prev = prevSavedVenueRef.current;
    prevSavedVenueRef.current = savedVenue;
    if (prev === null && savedVenue !== null) {
      // Just transitioned create -> edit: wipe any stale error / success banner.
      setBasicsError(null);
      setJustSaved(true); // show the success banner on the new edit form
    }
  }, [savedVenue]);

  // Build amenity_names from checkboxes + "Other" free text
  const buildAmenityNames = (): string[] => {
    const fromCheckboxes = [...checkedAmenities];
    const fromOther = otherAmenities
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set([...fromCheckboxes, ...fromOther])];
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent double-firing: if we're already in-flight, ignore this call.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setBasicsError(null);
    setJustSaved(false);
    const body: VenueCreateRequest = {
      name,
      category,
      address,
      city,
      unit_type: unitType,
      base_price: basePrice,
      description: description || undefined,
      state: stateField || undefined,
      pincode: pincode || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      amenity_names: buildAmenityNames(),
    };
    try {
      if (savedVenue) {
        const updated = await updateVenue.mutateAsync({ venueId: savedVenue.id, body });
        setSavedVenue(updated);
        setJustSaved(true);
      } else {
        const created = await createVenue.mutateAsync(body);
        // setSavedVenue triggers the useEffect above which sets justSaved and
        // clears basicsError — don't set justSaved here to avoid the race
        // where justSaved=true briefly shows on the old wizard form before the
        // edit form renders.
        setSavedVenue(created);
      }
    } catch (err) {
      setBasicsError(errorMessage(err));
    } finally {
      isSubmittingRef.current = false;
    }
  };


  const isEditMode = Boolean(savedVenue);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/50 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-chalk w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl my-0 sm:mt-16 sm:mb-16">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink/10 sticky top-0 bg-chalk sm:rounded-t-2xl z-10">
          <h2 className="font-display text-2xl text-pitch font-semibold">
            {isEditMode ? 'Manage Venue' : 'List a New Venue'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-mist rounded-full transition-colors cursor-pointer ease-out" aria-label="Close">
            <X size={20} className="text-ink" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-8">

          {/* Status / rejection / suspension banners (edit mode) */}
          {savedVenue && (
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
              <span
                className={`px-2.5 py-1 rounded-full font-semibold ${
                  savedVenue.status === 'active'
                    ? 'bg-primary-container text-on-primary-container'
                    : savedVenue.status === 'suspended'
                      ? 'bg-red-50 text-clay border border-red-200'
                      : savedVenue.status === 'draft'
                        ? 'bg-mist text-on-surface-variant border border-ink/10'
                        : 'bg-marigold/15 text-marigold'
                }`}
              >
                {savedVenue.status.replace('_', ' ')}
              </span>
            </div>
          )}
          {savedVenue?.rejection_reason && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-clay">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>Rejected: {savedVenue.rejection_reason}. Edit and re-save to submit for review again.</span>
            </div>
          )}
          {savedVenue?.suspension_reason && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-clay">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>Suspended: {savedVenue.suspension_reason}. Contact support to resolve this.</span>
            </div>
          )}

          {/* ── WIZARD (create mode) / FLAT FORM (edit mode) ── */}
          {isEditMode ? (
            // Edit mode: show all fields at once in one form
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <EditFormFields
                name={name} setName={setName}
                category={category} setCategory={setCategory}
                unitType={unitType} setUnitType={setUnitType}
                basePrice={basePrice} setBasePrice={setBasePrice}
                capacity={capacity} setCapacity={setCapacity}
                description={description} setDescription={setDescription}
                address={address} setAddress={setAddress}
                city={city} setCity={setCity}
                stateField={stateField} setStateField={setStateField}
                pincode={pincode} setPincode={setPincode}
                savedVenue={savedVenue}
              />
              <AmenitiesStep
                category={category}
                presetAmenities={presetAmenities}
                checkedAmenities={checkedAmenities}
                toggleAmenity={toggleAmenity}
                otherAmenities={otherAmenities}
                setOtherAmenities={setOtherAmenities}
              />
              <SubmitBar error={basicsError} justSaved={justSaved} saving={saving} savedVenue={savedVenue} />
            </form>
          ) : (
            // Create mode: multi-step wizard
            <>
              <StepIndicator current={step} total={TOTAL_STEPS} labels={STEP_LABELS} />

              {step === 0 && (
                <div className="space-y-4">
                  <BasicsStep
                    name={name} setName={setName}
                    category={category} setCategory={setCategory}
                    unitType={unitType} setUnitType={setUnitType}
                    savedVenue={savedVenue}
                    basePrice={basePrice} setBasePrice={setBasePrice}
                    capacity={capacity} setCapacity={setCapacity}
                    description={description} setDescription={setDescription}
                  />
                  <WizardNavBar
                    step={step}
                    total={TOTAL_STEPS}
                    canNext={Boolean(name && category && basePrice)}
                    onNext={() => setStep(1)}
                    onBack={undefined}
                  />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <LocationStep
                    address={address} setAddress={setAddress}
                    city={city} setCity={setCity}
                    stateField={stateField} setStateField={setStateField}
                    pincode={pincode} setPincode={setPincode}
                  />
                  <WizardNavBar
                    step={step}
                    total={TOTAL_STEPS}
                    canNext={Boolean(address && city)}
                    onNext={() => setStep(2)}
                    onBack={() => setStep(0)}
                  />
                </div>
              )}

              {step === 2 && (
                <form onSubmit={handleFinalSubmit} className="space-y-4">
                  <AmenitiesStep
                    category={category}
                    presetAmenities={presetAmenities}
                    checkedAmenities={checkedAmenities}
                    toggleAmenity={toggleAmenity}
                    otherAmenities={otherAmenities}
                    setOtherAmenities={setOtherAmenities}
                  />
                  <SubmitBar error={basicsError} justSaved={justSaved} saving={saving} savedVenue={savedVenue} />
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-pitch transition-colors cursor-pointer ease-out"
                  >
                    <ChevronLeft size={16} /> Back to Location
                  </button>
                </form>
              )}
            </>
          )}

          {/* ── Photos + Inventory: only once venue exists ── */}
          {savedVenue && (
            <>
              <div className="h-px bg-ink/10" />
              <PhotosSection venue={savedVenue} onVenueUpdated={setSavedVenue} />
              <div className="h-px bg-ink/10" />
              <InventorySection venue={savedVenue} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Wizard nav bar ────────────────────────────────────────────────────────
function WizardNavBar({
  step,
  total,
  canNext,
  onNext,
  onBack,
}: {
  step: number;
  total: number;
  canNext: boolean;
  onNext: (() => void) | undefined;
  onBack: (() => void) | undefined;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-pitch transition-colors cursor-pointer ease-out"
        >
          <ChevronLeft size={16} /> Back
        </button>
      ) : <div />}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="flex items-center gap-1 px-5 py-2.5 bg-pitch hover:bg-[#15462E] text-chalk rounded-lg text-sm font-bold transition active:scale-[0.97] cursor-pointer disabled:opacity-50 ease-out"
        >
          Next <ChevronRight size={16} />
          <span className="text-chalk/60 text-xs ml-1">{step + 1}/{total}</span>
        </button>
      )}
    </div>
  );
}

// ── Step 1: Basics ────────────────────────────────────────────────────────
function BasicsStep({
  name, setName,
  category, setCategory,
  unitType, setUnitType,
  savedVenue,
  basePrice, setBasePrice,
  capacity, setCapacity,
  description, setDescription,
}: {
  name: string; setName: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  unitType: UnitType; setUnitType: (v: UnitType) => void;
  savedVenue: ApiVenue | null;
  basePrice: string; setBasePrice: (v: string) => void;
  capacity: string; setCapacity: (v: string) => void;
  description: string; setDescription: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="block sm:col-span-2">
        <span className="text-xs font-semibold text-on-surface-variant">Venue name *</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. The Grand Turf Arena"
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-on-surface-variant">Category *</span>
        <GroundSelect
            value={category}
            onValueChange={() => {}}
            options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: `${o.label}` }))}
            triggerClassName="w-full sm:w-[200px]"
          />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-on-surface-variant">Pricing unit *</span>
        <GroundSelect
            value={unitType}
            onValueChange={() => {}}
            options={UNIT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: `${o.label}` }))}
            triggerClassName="w-full sm:w-[200px]"
          />
        {savedVenue && (
          <span className="text-[11px] text-ink/40">Locked after creation — existing slots depend on it.</span>
        )}
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-on-surface-variant">
          Base price (₹ per {unitType === 'hour' ? 'hour' : unitType === 'half_day' ? 'half-day' : 'full day'}) *
        </span>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-on-surface-variant">Capacity (people)</span>
        <input
          type="number"
          min="1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-xs font-semibold text-on-surface-variant">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Tell guests what makes your venue special…"
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
    </div>
  );
}

// ── Step 2: Location ──────────────────────────────────────────────────────
function LocationStep({
  address, setAddress,
  city, setCity,
  stateField, setStateField,
  pincode, setPincode,
}: {
  address: string; setAddress: (v: string) => void;
  city: string; setCity: (v: string) => void;
  stateField: string; setStateField: (v: string) => void;
  pincode: string; setPincode: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="block sm:col-span-2">
        <span className="text-xs font-semibold text-on-surface-variant">Address *</span>
        <input
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address, building, area"
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-on-surface-variant">City *</span>
        <input
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-on-surface-variant">State</span>
        <input
          value={stateField}
          onChange={(e) => setStateField(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-on-surface-variant">Pincode</span>
        <input
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
    </div>
  );
}

// ── Step 3: Amenities ─────────────────────────────────────────────────────
function AmenitiesStep({
  category,
  presetAmenities,
  checkedAmenities,
  toggleAmenity,
  otherAmenities,
  setOtherAmenities,
}: {
  category: string;
  presetAmenities: string[];
  checkedAmenities: Set<string>;
  toggleAmenity: (name: string) => void;
  otherAmenities: string;
  setOtherAmenities: (v: string) => void;
}) {
  const categoryLabel = CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-on-surface-variant mb-2">
          Common amenities for <span className="text-pitch">{categoryLabel}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {presetAmenities.map((amenity) => (
            <label
              key={amenity}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm font-sans select-none ${
                checkedAmenities.has(amenity)
                  ? 'bg-pitch/5 border-pitch/30 text-pitch'
                  : 'border-ink/10 bg-mist text-on-surface-variant hover:border-pitch/20'
              } ease-out`}
            >
              <input
                type="checkbox"
                className="accent-[#1c5e3f] w-4 h-4"
                checked={checkedAmenities.has(amenity)}
                onChange={() => toggleAmenity(amenity)}
              />
              <span>{amenity}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-on-surface-variant">Other amenities (comma-separated)</span>
        <input
          value={otherAmenities}
          onChange={(e) => setOtherAmenities(e.target.value)}
          placeholder="e.g. Rooftop terrace, Live DJ setup, VIP Lounge"
          className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
        />
      </label>
    </div>
  );
}

// ── Edit mode combined fields ─────────────────────────────────────────────
function EditFormFields(props: {
  name: string; setName: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  unitType: UnitType; setUnitType: (v: UnitType) => void;
  basePrice: string; setBasePrice: (v: string) => void;
  capacity: string; setCapacity: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  address: string; setAddress: (v: string) => void;
  city: string; setCity: (v: string) => void;
  stateField: string; setStateField: (v: string) => void;
  pincode: string; setPincode: (v: string) => void;
  savedVenue: ApiVenue | null;
}) {
  return (
    <>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">Basics</p>
        <BasicsStep {...props} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">Location</p>
        <LocationStep {...props} />
      </div>
    </>
  );
}

// ── Submit bar ────────────────────────────────────────────────────────────
function SubmitBar({
  error,
  justSaved,
  saving,
  savedVenue,
}: {
  error: string | null;
  justSaved: boolean;
  saving: boolean;
  savedVenue: ApiVenue | null;
}) {
  return (
    <div>
      {error && <p className="text-sm text-clay mb-2">{error}</p>}
      {justSaved && !error && (
        <p className="text-sm text-pitch flex items-center gap-1.5 mb-2">
          <CheckCircle2 size={15} /> Saved. {!savedVenue?.rejection_reason && 'Pending admin review before it goes live.'}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="w-full sm:w-auto px-6 py-2.5 bg-pitch hover:bg-[#15462E] text-chalk rounded-lg text-sm font-bold transition active:scale-[0.97] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 ease-out"
      >
        {saving && <Loader2 size={15} className="animate-spin" />}
        {savedVenue ? 'Save changes' : 'Create venue'}
      </button>
    </div>
  );
}

// ── Photos section (unchanged) ────────────────────────────────────────────
function PhotosSection({ venue, onVenueUpdated }: { venue: ApiVenue; onVenueUpdated: (v: ApiVenue) => void }) {
  const uploadImage = useUploadVenueImage();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (file: File, isCover: boolean) => {
    setUploadError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Only JPEG or PNG images are accepted.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError('Image must be under 10MB.');
      return;
    }
    try {
      const updated = await uploadImage.mutateAsync({ venueId: venue.id, file, isCover });
      onVenueUpdated(updated);
    } catch (err) {
      setUploadError(errorMessage(err));
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="font-sans text-sm font-bold text-ink uppercase tracking-wide">Photos</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {venue.images.map((img) => (
          <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-mist border border-ink/10">
            <img src={img.url} alt={venue.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            {img.is_cover && (
              <span className="absolute top-1.5 left-1.5 bg-marigold text-ink text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Star size={9} fill="currentColor" /> Cover
              </span>
            )}
          </div>
        ))}
        <label className="aspect-square rounded-lg border-2 border-dashed border-ink/20 flex flex-col items-center justify-center gap-1 text-ink/40 hover:border-pitch hover:text-pitch transition-colors cursor-pointer ease-out">
          {uploadImage.isPending ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
          <span className="text-[10px] font-semibold text-center px-1">
            {venue.images.length === 0 ? 'Add cover photo' : 'Add photo'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            disabled={uploadImage.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file, venue.images.length === 0);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {uploadError && <p className="text-sm text-clay">{uploadError}</p>}
      <p className="text-[11px] text-ink/40">JPEG or PNG, up to 10MB. The first photo you add becomes the cover automatically.</p>
    </section>
  );
}

// ── Inventory section (unchanged) ─────────────────────────────────────────
function InventorySection({ venue }: { venue: ApiVenue }) {
  const { data: units = [], isLoading } = useOwnerInventory(venue.id);
  const addUnits = useAddInventoryUnits();
  const isHourly = venue.unit_type === 'hour';

  type DraftRow = { date: string; startTime: string; endTime: string };
  const [rows, setRows] = useState<DraftRow[]>([{ date: '', startTime: '', endTime: '' }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState<number | null>(null);

  const updateRow = (i: number, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAddedCount(null);
    const payload: InventoryUnitCreateRequest[] = [];
    for (const row of rows) {
      if (!row.date) continue;
      if (isHourly && (!row.startTime || !row.endTime)) {
        setFormError('Hourly venues need both a start and end time for every slot.');
        return;
      }
      payload.push({
        date: row.date,
        start_time: isHourly ? row.startTime : undefined,
        end_time: isHourly ? row.endTime : undefined,
        price: venue.base_price,
      });
    }
    if (payload.length === 0) {
      setFormError('Add at least one date.');
      return;
    }
    try {
      const created = await addUnits.mutateAsync({ venueId: venue.id, units: payload });
      setAddedCount(created.length);
      setRows([{ date: '', startTime: '', endTime: '' }]);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const upcomingUnits = [...units]
    .sort((a, b) => (a.date + (a.start_time ?? '')).localeCompare(b.date + (b.start_time ?? '')))
    .slice(0, 8);

  return (
    <section className="space-y-3">
      <h3 className="font-sans text-sm font-bold text-ink uppercase tracking-wide">Availability</h3>

      <form onSubmit={handleSubmit} className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              required
              value={row.date}
              onChange={(e) => updateRow(i, { date: e.target.value })}
              className="rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
            />
            {isHourly && (
              <>
                <input
                  type="time"
                  required
                  value={row.startTime}
                  onChange={(e) => updateRow(i, { startTime: e.target.value })}
                  className="rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
                />
                <span className="text-ink/40 text-sm">to</span>
                <input
                  type="time"
                  required
                  value={row.endTime}
                  onChange={(e) => updateRow(i, { endTime: e.target.value })}
                  className="rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
                />
              </>
            )}
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                className="p-2 text-clay hover:bg-red-50 rounded-lg cursor-pointer"
                aria-label="Remove row"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { date: '', startTime: '', endTime: '' }])}
            className="flex items-center gap-1 text-xs font-semibold text-pitch hover:underline cursor-pointer"
          >
            <Plus size={14} /> Add another slot
          </button>
          <button
            type="submit"
            disabled={addUnits.isPending}
            className="ml-auto px-4 py-2 bg-pitch hover:bg-[#15462E] text-chalk rounded-lg text-xs font-bold transition active:scale-[0.97] cursor-pointer disabled:opacity-60 flex items-center gap-2 ease-out"
          >
            {addUnits.isPending && <Loader2 size={13} className="animate-spin" />}
            Add to calendar
          </button>
        </div>
        {formError && <p className="text-sm text-clay">{formError}</p>}
        {addedCount !== null && !formError && (
          <p className="text-sm text-pitch flex items-center gap-1.5">
            <CheckCircle2 size={15} /> Added {addedCount} slot{addedCount === 1 ? '' : 's'}.
          </p>
        )}
      </form>

      <div>
        <p className="text-xs font-semibold text-on-surface-variant mb-1.5">
          {isLoading ? 'Loading current availability…' : `Upcoming (${units.length} total slot${units.length === 1 ? '' : 's'})`}
        </p>
        {!isLoading && upcomingUnits.length === 0 && (
          <p className="text-xs text-ink/40">No slots yet — add some dates above.</p>
        )}
        <div className="space-y-1">
          {upcomingUnits.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-xs font-mono bg-mist rounded-lg px-3 py-1.5">
              <span className="flex items-center gap-1.5 text-ink">
                <Calendar size={12} className="text-on-surface-variant" />
                {u.date}
                {u.start_time && ` · ${u.start_time.slice(0, 5)}–${u.end_time?.slice(0, 5)}`}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-sans font-bold ${
                  u.status === 'available'
                    ? 'bg-primary-container text-on-primary-container'
                    : u.status === 'held'
                      ? 'bg-marigold/15 text-marigold'
                      : 'bg-ink/10 text-on-surface-variant'
                }`}
              >
                {u.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
