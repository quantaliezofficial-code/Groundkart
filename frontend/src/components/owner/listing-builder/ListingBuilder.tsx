import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { ownerApi } from '../../../lib/api/owner';
import { api, ApiError } from '../../../lib/api/client';
import { VenueCreateRequest, VenueUpdateRequest, UnitType } from '../../../lib/api/types';
import { useToast } from '../../ui/Toast';
import IdentityStep from './IdentityStep';
import CategoryStep from './CategoryStep';
import PurposeDetailsStep from './PurposeDetailsStep';
import LocationStep from './LocationStep';
import RentalSetupStep from './RentalSetupStep';
import AvailabilityStep from './AvailabilityStep';
import MediaStep from './MediaStep';
import FeaturesStep from './FeaturesStep';
import PresentationStep from './PresentationStep';
import SubmitStep, { PROBLEM_MAP } from './SubmitStep';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ListingBuilderProps {
  venueId?: string | null;
  onClose?: () => void;
  onCancel?: () => void;
  onComplete: () => void;
}

export type ListingFormData = VenueCreateRequest & {
  // Multi-category & multi-space-type support
  category_ids?: string[];
  categories?: string[];
  venue_type_ids?: string[];
  venue_types?: string[];
  custom_space_types?: string[];
  custom_purposes?: string[];

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
  show_internal_name?: boolean;

  // Preserved step states across navigation and remounts:
  purpose_drafts?: any[];
  rental_configs?: any;
  availability_config?: any;
  media_cache?: any[];
};

const STEP_LABELS = [
  'Basics',
  'Type & Purposes',
  'Purpose Details',
  'Location',
  'Features & Amenities',
  'Rental Setup',
  'Availability',
  'Photos & Videos',
  'Description',
  'Review & Submit',
];

const VALID_VENUE_UPDATE_KEYS = new Set([
  'name',
  'display_name',
  'tagline',
  'category',
  'category_id',
  'venue_type_id',
  'use_case_ids',
  'description',
  'address',
  'city',
  'state',
  'pincode',
  'capacity',
  'unit_type',
  'base_price',
  'amenity_names',
  'content_blocks',
  'status',
]);

function sanitizeVenueUpdatePayload(raw: Partial<ListingFormData>): VenueUpdateRequest {
  const result: any = {};
  for (const [key, value] of Object.entries(raw)) {
    if (VALID_VENUE_UPDATE_KEYS.has(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function extractMissingItems(err: any): string[] {
  // 1. Check err?.data?.detail?.missing (standard FastAPI 422 with dict detail)
  if (Array.isArray(err?.data?.detail?.missing)) {
    return err.data.detail.missing
      .map((s: any) => String(s).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().trim())
      .filter(Boolean);
  }
  // 2. Check err?.data?.missing
  if (Array.isArray(err?.data?.missing)) {
    return err.data.missing
      .map((s: any) => String(s).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().trim())
      .filter(Boolean);
  }
  // 3. If err.detail is a JSON string, try to parse it
  const detail = typeof err?.detail === 'string' ? err.detail : '';
  if (detail.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(detail);
      if (Array.isArray(parsed?.missing)) {
        return parsed.missing
          .map((s: any) => String(s).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().trim())
          .filter(Boolean);
      }
      if (Array.isArray(parsed?.detail?.missing)) {
        return parsed.detail.missing
          .map((s: any) => String(s).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().trim())
          .filter(Boolean);
      }
    } catch {
      // not valid JSON, proceed to regex
    }
  }
  // 4. Fallback text parsing for string messages like "missing inventory, photos"
  if (detail.toLowerCase().includes('missing')) {
    const afterMissing = detail.split(/missing/i)[1] || '';
    const matches = afterMissing.match(/[a-zA-Z0-9_]+/g);
    if (matches) {
      return matches
        .map((s) => s.toLowerCase().trim())
        .filter((s) => s !== 'and' && s !== 'or' && s.length > 1);
    }
  }
  return [];
}

const DRAFT_STORAGE_KEY = 'groundkart_new_venue_draft';

function getInitialDraft(venueId?: string | null): {
  step: number;
  createdVenueId: string | null;
  formData: Partial<ListingFormData>;
  hasDraft: boolean;
} {
  const defaultFormData: Partial<ListingFormData> = {
    name: '',
    display_name: '',
    tagline: '',
    description: '',
    category: 'Sports & Fitness',
    categories: ['Sports & Fitness'],
    category_ids: [],
    venue_type_ids: [],
    custom_space_types: [],
    custom_purposes: [],
    address: '',
    city: '',
    unit_type: 'hour',
    base_price: '',
    amenity_names: [],
    content_blocks: [],
  };

  if (!venueId) {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.formData) {
          const validStep =
            typeof parsed.step === 'number' && parsed.step >= 1 && parsed.step <= 10
              ? parsed.step
              : 1;
          return {
            step: validStep,
            createdVenueId: parsed.createdVenueId || null,
            formData: { ...defaultFormData, ...parsed.formData },
            hasDraft: true,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse draft from localStorage', e);
    }
    return { step: 1, createdVenueId: null, formData: defaultFormData, hasDraft: false };
  } else {
    let savedStep = 1;
    try {
      const s = sessionStorage.getItem(`groundkart_venue_step_${venueId}`);
      if (s) {
        const num = parseInt(s, 10);
        if (num >= 1 && num <= 10) savedStep = num;
      }
    } catch {}
    return { step: savedStep, createdVenueId: venueId, formData: defaultFormData, hasDraft: false };
  }
}

export default function ListingBuilder({ venueId, onClose, onCancel, onComplete }: ListingBuilderProps) {
  const handleClose = onClose || onCancel || (() => {});
  const initialData = useRef(getInitialDraft(venueId)).current;
  const [step, setStep] = useState(initialData.step);
  const [isLoadingVenue, setIsLoadingVenue] = useState(Boolean(venueId));
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ListingFormData>>(initialData.formData);
  const [createdVenueId, setCreatedVenueId] = useState<string | null>(initialData.createdVenueId);
  const [mediaPhotoCount, setMediaPhotoCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProblems, setSubmissionProblems] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [isDraftRestored, setIsDraftRestored] = useState(initialData.hasDraft && !venueId);

  const pendingChangesRef = useRef<Partial<ListingFormData>>({});
  const inFlightRef = useRef<boolean>(false);
  const queuedAfterInFlightRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();
  const totalSteps = STEP_LABELS.length;

  const { data: venueTypes = [] } = useQuery({
    queryKey: ['venue-types'],
    queryFn: () => api.get<any[]>('/api/v1/venue-types'),
  });

  // 1. Load existing venue data if venueId is provided
  useEffect(() => {
    if (!venueId) {
      setIsLoadingVenue(false);
      return;
    }
    setIsLoadingVenue(true);
    ownerApi
      .getVenue(venueId)
      .then((v) => {
        setFormData({
          name: v.name,
          display_name: v.display_name || '',
          tagline: v.tagline || '',
          description: v.description || '',
          category: v.category || 'Sports & Fitness',
          category_id: v.category_id,
          venue_type_id: v.venue_type_id,
          category_ids: v.category_id ? [v.category_id] : [],
          categories: v.category ? [v.category] : ['Sports & Fitness'],
          venue_type_ids: v.venue_type_id ? [v.venue_type_id] : [],
          custom_space_types: [],
          custom_purposes: [],
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
        if (v.rejection_reason) {
          setRejectionReason(v.rejection_reason);
        }
        if (v.media) {
          const photoCount = v.media.filter(
            (m) => !m.url.toLowerCase().endsWith('.mp4') && !m.url.toLowerCase().endsWith('.webm')
          ).length;
          setMediaPhotoCount(photoCount);
        }
      })
      .catch((err) => {
        console.error('Failed to load venue for editing', err);
        toast.error('Failed to load venue details');
      })
      .finally(() => {
        setIsLoadingVenue(false);
      });
  }, [venueId]);

  // 3. Debounced Autosave: Single queue, 800ms debounce, merges pending changes
  const flushAutosave = useCallback(async (): Promise<boolean> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!createdVenueId) {
      return true;
    }

    if (Object.keys(pendingChangesRef.current).length === 0) {
      if (!inFlightRef.current && saveStatus !== 'failed') {
        setSaveStatus('saved');
      }
      return true;
    }

    if (inFlightRef.current) {
      queuedAfterInFlightRef.current = true;
      return false;
    }

    const payloadToSave = { ...pendingChangesRef.current };
    pendingChangesRef.current = {};
    inFlightRef.current = true;
    setSaveStatus('saving');

    try {
      const sanitized = sanitizeVenueUpdatePayload(payloadToSave);
      if (Object.keys(sanitized).length > 0) {
        await ownerApi.updateVenue(createdVenueId, sanitized);
      }
      setSaveStatus('saved');
      inFlightRef.current = false;

      if (Object.keys(pendingChangesRef.current).length > 0 || queuedAfterInFlightRef.current) {
        queuedAfterInFlightRef.current = false;
        return flushAutosave();
      }
      return true;
    } catch (err) {
      console.error('Autosave failed:', err);
      // Re-queue unsaved fields so next attempt includes them
      pendingChangesRef.current = { ...payloadToSave, ...pendingChangesRef.current };
      inFlightRef.current = false;
      setSaveStatus('failed');
      return false;
    }
  }, [createdVenueId, saveStatus]);

  // Flush on page unload if pending changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingChangesRef.current).length > 0) {
        flushAutosave();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [flushAutosave]);

  // Persist in-progress draft to localStorage so moving between pages / refreshing doesn't lose data
  useEffect(() => {
    if (!venueId) {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            step,
            createdVenueId,
            formData,
            savedAt: Date.now(),
          })
        );
      } catch (err) {
        console.warn('Failed to save listing draft to localStorage', err);
      }
    } else {
      try {
        sessionStorage.setItem(`groundkart_venue_step_${venueId}`, String(step));
      } catch {}
    }
  }, [step, createdVenueId, formData, venueId]);

  const handleDiscardDraft = () => {
    const confirmed = window.confirm(
      'Are you sure you want to discard this draft? All your unsaved inputs across all steps will be cleared.'
    );
    if (confirmed) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      setFormData({
        name: '',
        display_name: '',
        tagline: '',
        description: '',
        category: 'Sports & Fitness',
        categories: ['Sports & Fitness'],
        category_ids: [],
        venue_type_ids: [],
        custom_space_types: [],
        custom_purposes: [],
        address: '',
        city: '',
        unit_type: 'hour',
        base_price: '',
        amenity_names: [],
        content_blocks: [],
      });
      setCreatedVenueId(null);
      setStep(1);
      setIsDraftRestored(false);
      toast.success('Draft discarded');
    }
  };

  const updateForm = (data: Partial<ListingFormData>) => {
    const patched = { ...data };
    if (patched.venue_type_id && venueTypes.length > 0) {
      const vt = venueTypes.find((t: any) => t.id === patched.venue_type_id);
      if (vt && vt.category_id && (!patched.category_id || patched.category_id !== vt.category_id)) {
        patched.category_id = vt.category_id;
      }
    }
    setFormData((prev) => ({ ...prev, ...patched }));
    if (createdVenueId) {
      pendingChangesRef.current = { ...pendingChangesRef.current, ...patched };
      setSaveStatus('saving');
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        flushAutosave();
      }, 800);
    }
  };

  // 4. Validate each step and disable Next with an inline reason
  const getStepValidation = (): { isValid: boolean; reason?: string } => {
    switch (step) {
      case 1: {
        const name = (formData.display_name || formData.name || '').trim();
        if (!name) return { isValid: false, reason: 'Venue name is required' };
        return { isValid: true };
      }
      case 2: {
        const hasCategory =
          (formData.category_ids && formData.category_ids.length > 0) ||
          Boolean(formData.category_id) ||
          Boolean(formData.category?.trim());
        if (!hasCategory) {
          return { isValid: false, reason: 'Select at least one venue category' };
        }
        return { isValid: true };
      }
      case 3: {
        return { isValid: true };
      }
      case 4: {
        const address = (formData.address || '').trim();
        const city = (formData.city || '').trim();
        if (!address || !city) {
          return { isValid: false, reason: 'Street address and city are required' };
        }
        if (formData.pincode && formData.pincode.trim() && !/^\d{6}$/.test(formData.pincode.trim())) {
          return { isValid: false, reason: 'Pincode must be exactly 6 digits' };
        }
        return { isValid: true };
      }
      case 5: {
        return { isValid: true };
      }
      case 6: {
        const price = parseFloat(String(formData.base_price || '0'));
        if (isNaN(price) || price <= 0) {
          return { isValid: false, reason: 'Base price must be greater than 0' };
        }
        return { isValid: true };
      }
      case 7: {
        return { isValid: true };
      }
      case 8: {
        if (mediaPhotoCount < 3) {
          const needed = 3 - mediaPhotoCount;
          return {
            isValid: false,
            reason: `Add at least ${needed} more photo${needed > 1 ? 's' : ''} to proceed (${mediaPhotoCount}/3)`,
          };
        }
        return { isValid: true };
      }
      case 9: {
        return { isValid: true };
      }
      default:
        return { isValid: true };
    }
  };

  const stepValidation = getStepValidation();

  const handleNext = async () => {
    if (!stepValidation.isValid) {
      toast.error(stepValidation.reason || 'Please complete the required fields to proceed');
      return;
    }

    // Flush any pending debounced changes before navigation
    await flushAutosave();

    // 2. Create the venue draft on Step 4 -> Step 5 transition
    if (step === 4 && !createdVenueId) {
      try {
        const venueName = (formData.display_name || formData.name)!.trim();
        let finalCategoryId = formData.category_id;
        const finalVenueTypeId = formData.venue_type_id;
        if (finalVenueTypeId && venueTypes.length > 0) {
          const vt = venueTypes.find((t: any) => t.id === finalVenueTypeId);
          if (vt && vt.category_id) {
            finalCategoryId = vt.category_id;
          }
        }

        const draftPayload: VenueCreateRequest = {
          name: venueName,
          display_name: formData.display_name?.trim() || undefined,
          tagline: formData.tagline?.trim() || undefined,
          category: formData.category?.trim() || undefined,
          category_id: finalCategoryId,
          venue_type_id: finalVenueTypeId,
          use_case_ids: formData.use_case_ids,
          address: formData.address!.trim(),
          city: formData.city!.trim(),
          unit_type: (formData.unit_type as UnitType) || 'hour',
          base_price: formData.base_price && parseFloat(formData.base_price) > 0 ? formData.base_price : '1000',
          state: formData.state?.trim() || undefined,
          pincode: formData.pincode?.trim() || undefined,
          capacity: formData.capacity,
          amenity_names: formData.amenity_names,
          content_blocks: formData.content_blocks,
          status: 'draft',
          save_as_draft: true,
        };

        const res = await ownerApi.createVenue(draftPayload);
        setCreatedVenueId(res.id);
        setSaveStatus('saved');

        // Sync any purpose drafts configured in Step 3
        if ((formData as any).purpose_drafts && (formData as any).purpose_drafts.length > 0) {
          for (const p of (formData as any).purpose_drafts) {
            try {
              await ownerApi.createPurpose(res.id, {
                use_case_id: p.use_case_id,
                custom_name: p.custom_name,
                description: p.description,
                max_guests: p.max_guests,
                allowed_modes: p.allowed_modes,
                price_override: p.price_override || null,
                rules: p.rules,
                enabled: p.enabled,
              });
            } catch (e) {
              console.warn('Failed to sync purpose draft to created venue', e);
            }
          }
        }

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
      // 9. Final submission to pending_review
      if (createdVenueId) {
        setIsSubmitting(true);
        try {
          await ownerApi.updateVenue(createdVenueId, { status: 'pending_review' } as any);
          try {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            if (venueId) {
              sessionStorage.removeItem(`groundkart_venue_step_${venueId}`);
            }
          } catch {}
          queryClient.invalidateQueries({ queryKey: ['owner-venues'] });
          toast.success('Venue submitted for review successfully!');
          onComplete();
        } catch (err: any) {
          console.error('Failed to submit venue for review', err);
          const missing = extractMissingItems(err);
          if (missing.length > 0) {
            setSubmissionProblems(missing);
          }
          let userMsg = 'Failed to submit venue for review.';
          if (missing.length > 0) {
            const readableMissing = missing
              .map((m) => PROBLEM_MAP[m]?.label || m)
              .join(', ');
            userMsg = `Please resolve missing items before submitting: ${readableMissing}`;
          } else if (err instanceof ApiError) {
            if (typeof err.data?.detail === 'string') {
              userMsg = err.data.detail;
            } else if (typeof err.detail === 'string' && !err.detail.trim().startsWith('{')) {
              userMsg = err.detail;
            }
          } else if (err?.message) {
            userMsg = err.message;
          }
          toast.error(userMsg);
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

  const handleBack = async () => {
    if (step > 1) {
      await flushAutosave();
      setStep(step - 1);
    }
  };

  // 10. Save & Exit flushes first and warns if unsaved before Step 4
  const handleSaveAndExit = async () => {
    if (!createdVenueId) {
      const confirmExit = window.confirm(
        'You have not completed the initial steps (Steps 1–4) to save a draft. If you exit now, your changes will not be saved. Are you sure you want to exit?'
      );
      if (confirmExit) {
        handleClose();
      }
      return;
    }

    await flushAutosave();
    queryClient.invalidateQueries({ queryKey: ['owner-venues'] });
    toast.success('Draft saved successfully');
    handleClose();
  };

  if (isLoadingVenue) {
    return (
      <div className="fixed inset-0 z-50 bg-background-mist flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 bg-chalk p-8 rounded-2xl shadow-sm border border-surface-container">
          <Loader2 className="w-8 h-8 animate-spin text-pitch" />
          <p className="text-sm font-semibold text-ink">Loading venue listing...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background-mist flex flex-col font-sans overflow-hidden"
      data-lenis-prevent
    >
      {/* Header */}
      <header className="bg-pitch text-chalk border-b border-white/10 px-6 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveAndExit}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-chalk/70 hover:text-chalk cursor-pointer"
            title="Close listing builder"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-display font-bold text-chalk">
                {formData.display_name || formData.name || 'List a new venue'}
              </h1>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-semibold text-marigold border border-white/15">
                {STEP_LABELS[step - 1]}
              </span>
            </div>
            <p className="text-xs text-chalk/60">
              Step {step} of {totalSteps}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDraftRestored && !createdVenueId && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <Check className="w-3 h-3" /> Draft restored
            </span>
          )}

          {/* Dynamic Autosave Status Chip */}
          {createdVenueId && (
            <>
              {saveStatus === 'saving' && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-amber-950/70 px-2.5 py-1 rounded-full border border-amber-500/30">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  <Check className="w-3 h-3" /> Draft saved
                </span>
              )}
              {saveStatus === 'failed' && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-rose-300 bg-rose-950/70 px-2.5 py-1 rounded-full border border-rose-500/30">
                  <AlertCircle className="w-3 h-3" /> Save failed
                  <button
                    type="button"
                    onClick={() => flushAutosave()}
                    className="ml-1 underline font-bold hover:text-rose-200 cursor-pointer"
                  >
                    Retry
                  </button>
                </span>
              )}
            </>
          )}

          {!venueId && (isDraftRestored || createdVenueId || formData.name || formData.display_name) && (
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-xs sm:text-sm font-semibold text-rose-300 hover:text-rose-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-950/40 border border-rose-500/20 cursor-pointer"
              title="Discard draft and reset"
            >
              Discard Draft
            </button>
          )}

          <button
            onClick={handleSaveAndExit}
            className="text-xs sm:text-sm font-semibold text-chalk/90 hover:text-chalk transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10 border border-white/15 cursor-pointer"
          >
            Save & Exit
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1.5 bg-surface-container-high overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-marigold transition-all duration-300 ease-in-out"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      {/* Main Content Area */}
      <main
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 md:p-10 custom-scrollbar overscroll-contain"
        data-lenis-prevent
        tabIndex={0}
      >
        <div
          className="w-full max-w-2xl mx-auto bg-chalk rounded-2xl shadow-sm border border-surface-container-highest p-6 sm:p-9 my-4 sm:my-8"
        >
          {/* Rejection Alert Banner */}
          {rejectionReason && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900">Listing Revision Required</p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Reason for rejection: <strong>{rejectionReason}</strong>. Please update the necessary fields and submit for review again.
                </p>
              </div>
            </div>
          )}

          {step === 1 && <IdentityStep data={formData} update={updateForm} />}
          {step === 2 && <CategoryStep data={formData} update={updateForm} />}
          {step === 3 && <PurposeDetailsStep data={formData} update={updateForm} venueId={createdVenueId} />}
          {step === 4 && <LocationStep data={formData} update={updateForm} />}
          {step === 5 && <FeaturesStep data={formData} update={updateForm} venueId={createdVenueId} />}
          {step === 6 && <RentalSetupStep data={formData} update={updateForm} venueId={createdVenueId} />}
          {step === 7 && <AvailabilityStep data={formData} update={updateForm} venueId={createdVenueId} />}
          {step === 8 && (
            <MediaStep
              venueId={createdVenueId}
              onComplete={() => {}}
              onPhotoCountChange={setMediaPhotoCount}
            />
          )}
          {step === 9 && <PresentationStep data={formData} update={updateForm} venueId={createdVenueId} />}
          {step === 10 && (
            <SubmitStep
              data={formData}
              update={updateForm}
              venueId={createdVenueId}
              submissionProblems={submissionProblems}
              onJumpToStep={(targetStep) => setStep(targetStep)}
            />
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="bg-chalk border-t border-surface-container-high px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
        <button
          type="button"
          onClick={handleBack}
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
          {/* Inline Validation Reason if Next is disabled */}
          {!stepValidation.isValid && stepValidation.reason && (
            <span role="alert" className="text-xs sm:text-sm text-rose-600 font-medium">
              {stepValidation.reason}
            </span>
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={!stepValidation.isValid || isSubmitting}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer ${
              !stepValidation.isValid || isSubmitting
                ? 'bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed opacity-60'
                : 'bg-marigold hover:bg-[#e5952e] text-pitch shadow-[0_2px_10px_rgba(244,181,68,0.35)] active:scale-[0.98]'
            }`}
          >
            {step === totalSteps ? (
              <>
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                <Check className="w-4 h-4 stroke-[2.5]" />
              </>
            ) : (
              <>
                Next <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
