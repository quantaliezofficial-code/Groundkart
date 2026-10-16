import React, { useState, useEffect } from 'react';
import { ownerApi } from '../../../lib/api/owner';
import { ApiError } from '../../../lib/api/client';
import { VenueCreateRequest } from '../../../lib/api/types';
import { useToast } from '../../ui/Toast';
import IdentityStep from './IdentityStep';
import CategoryStep from './CategoryStep';
import LocationStep from './LocationStep';
import MediaStep from './MediaStep';
import FeaturesStep from './FeaturesStep';
import PricingStep from './PricingStep';
import PoliciesStep from './PoliciesStep';
import PreviewStep from './PreviewStep';
import SubmitStep from './SubmitStep';
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';

interface ListingBuilderProps {
  venueId?: string | null;
  onClose: () => void;
  onComplete: () => void;
}

export type ListingFormData = VenueCreateRequest & {
  // Client-side transient fields
  space_environment?: string;
  landmark?: string;
  access_notes?: string;
  area_sqft?: string;
  operating_days?: string;
  open_time?: string;
  close_time?: string;
  cancellation_policy?: string;
  rule_toggles?: Record<string, boolean>;
  custom_rules?: string[];
};

const STEP_LABELS = [
  'Identity',
  'Category',
  'Location',
  'Photos & Media',
  'Features & Specs',
  'Pricing & Hours',
  'Policies & Rules',
  'Marketplace Preview',
  'Submit for Review',
];

export default function ListingBuilder({ venueId, onClose, onComplete }: ListingBuilderProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ListingFormData>>({
    name: '',
    display_name: '',
    tagline: '',
    description: '',
    category: 'Sports & Fitness',
    address: '',
    city: '',
    unit_type: 'hour',
    base_price: '',
    amenity_names: [],
    content_blocks: [],
  });
  const [createdVenueId, setCreatedVenueId] = useState<string | null>(venueId || null);
  const [mediaPhotoCount, setMediaPhotoCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const totalSteps = 9;

  // Load existing venue data if venueId is provided
  useEffect(() => {
    if (!venueId) return;
    ownerApi.getVenue(venueId).then((v) => {
      setFormData({
        name: v.name,
        display_name: v.display_name || '',
        tagline: v.tagline || '',
        description: v.description || '',
        category: v.category,
        category_id: v.category_id,
        venue_type_id: v.venue_type_id,
        use_case_ids: v.use_case_ids || [],
        address: v.address,
        city: v.city,
        state: v.state || '',
        pincode: v.pincode || '',
        capacity: v.capacity || undefined,
        unit_type: v.unit_type,
        base_price: v.base_price,
        amenity_names: v.amenities || [],
        content_blocks: v.content_blocks || [],
      });
      setCreatedVenueId(v.id);
      if (v.media) {
        const photoCount = v.media.filter(
          (m) => !m.url.toLowerCase().endsWith('.mp4') && !m.url.toLowerCase().endsWith('.webm')
        ).length;
        setMediaPhotoCount(photoCount);
      }
    }).catch((err) => {
      console.error('Failed to load venue for editing', err);
    });
  }, [venueId]);

  const handleNext = async () => {
    // Create the venue draft once we have minimum data (Step 3 transition to Step 4)
    if (step === 3 && !createdVenueId) {
      try {
        const draftPayload: VenueCreateRequest = {
          name: formData.display_name || formData.name || 'Unnamed Venue',
          category: formData.category || 'Sports & Fitness',
          category_id: formData.category_id,
          venue_type_id: formData.venue_type_id,
          use_case_ids: formData.use_case_ids,
          address: formData.address || '',
          city: formData.city || '',
          unit_type: formData.unit_type || 'hour',
          base_price: formData.base_price || '0',
          display_name: formData.display_name,
          tagline: formData.tagline,
          description: formData.description,
          state: formData.state,
          pincode: formData.pincode,
          capacity: formData.capacity,
          amenity_names: formData.amenity_names,
          content_blocks: formData.content_blocks,
          status: 'draft',
        };
        const res = await ownerApi.createVenue(draftPayload);
        setCreatedVenueId(res.id);
        setStep(step + 1);
      } catch (err: any) {
        console.error('Failed to create venue draft', err);
        const msg =
          err instanceof ApiError
            ? err.detail
            : err?.message || 'Failed to save venue draft. Please ensure Name, Category, Address, and City are filled in.';
        toast.error(msg);
      }
    } else if (step === totalSteps) {
      // Final submission to pending_review
      if (createdVenueId) {
        setIsSubmitting(true);
        try {
          await ownerApi.updateVenue(createdVenueId, { status: 'pending_review' } as any);
          toast.success('Venue submitted for review successfully!');
          onComplete();
        } catch (err: any) {
          console.error('Failed to submit venue for review', err);
          const msg =
            err instanceof ApiError ? err.detail : err?.message || 'Failed to submit venue for review.';
          toast.error(msg);
        } finally {
          setIsSubmitting(false);
        }
      } else {
        onComplete();
      }
    } else {
      setStep(step + 1);
    }
  };

  const updateForm = (data: Partial<ListingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    if (createdVenueId) {
      // Autosave non-destructive changes
      ownerApi.updateVenue(createdVenueId, data as any).catch(console.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background-mist flex flex-col font-sans">
      {/* Header */}
      <header className="bg-chalk border-b border-surface-container-high px-6 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-mist rounded-full transition-colors text-on-surface-variant hover:text-ink cursor-pointer"
            title="Close listing builder"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-display font-bold text-ink">
                {formData.display_name || formData.name || 'List a new venue'}
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-mist text-xs font-semibold text-on-surface-variant">
                {STEP_LABELS[step - 1]}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Step {step} of {totalSteps}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden md:inline-block text-xs font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            ✓ Auto-saving draft
          </span>
          <button
            onClick={onClose}
            className="text-xs sm:text-sm font-semibold text-pitch hover:text-ink transition-colors px-3 py-1.5 rounded-lg hover:bg-mist cursor-pointer"
          >
            Save & Exit
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-surface-container-highest">
        <div
          className="h-full bg-pitch transition-all duration-300 ease-in-out"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-10 flex justify-center">
        <div className="w-full max-w-2xl bg-chalk rounded-2xl shadow-sm border border-surface-container-highest p-6 sm:p-9 my-auto">
          {step === 1 && <IdentityStep data={formData} update={updateForm} />}
          {step === 2 && <CategoryStep data={formData} update={updateForm} />}
          {step === 3 && <LocationStep data={formData} update={updateForm} />}
          {step === 4 && (
            <MediaStep
              venueId={createdVenueId}
              onComplete={() => {}}
              onPhotoCountChange={setMediaPhotoCount}
            />
          )}
          {step === 5 && (
            <FeaturesStep data={formData} update={updateForm} venueId={createdVenueId} />
          )}
          {step === 6 && (
            <PricingStep data={formData} update={updateForm} venueId={createdVenueId} />
          )}
          {step === 7 && (
            <PoliciesStep data={formData} update={updateForm} venueId={createdVenueId} />
          )}
          {step === 8 && (
            <PreviewStep data={formData} update={updateForm} venueId={createdVenueId} />
          )}
          {step === 9 && (
            <SubmitStep data={formData} update={updateForm} venueId={createdVenueId} />
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="bg-chalk border-t border-surface-container-high px-6 py-4 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            step === 1
              ? 'text-on-surface-variant/40 cursor-not-allowed'
              : 'text-pitch hover:bg-mist'
          }`}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3">
          {step === 4 && mediaPhotoCount < 3 && (
            <span role="alert" className="text-xs sm:text-sm text-rose-600 font-medium">
              Add at least {3 - mediaPhotoCount} more photo{3 - mediaPhotoCount > 1 ? 's' : ''} to proceed ({mediaPhotoCount}/3)
            </span>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={(step === 4 && mediaPhotoCount < 3) || isSubmitting}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer ${
              step === 4 && mediaPhotoCount < 3
                ? 'bg-surface-container-highest text-on-surface-variant/60 cursor-not-allowed opacity-60'
                : 'bg-pitch hover:bg-ink text-chalk active:scale-[0.98]'
            }`}
          >
            {step === totalSteps ? (
              <>
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                Next <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
