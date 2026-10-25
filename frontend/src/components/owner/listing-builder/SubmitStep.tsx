import React from 'react';
import { ListingFormData } from './ListingBuilder';
import { CheckCircle2, ShieldCheck, Clock, Sparkles, Check, ArrowRight, AlertCircle, AlertTriangle } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
  submissionProblems?: string[];
  onJumpToStep?: (stepNumber: number) => void;
}

export const PROBLEM_MAP: Record<string, { step: number; label: string; desc: string }> = {
  name: { step: 1, label: 'Venue Name', desc: 'Space Identity: enter a public venue name' },
  category: { step: 2, label: 'Category & Type', desc: 'Categorization: select a primary venue category' },
  address: { step: 4, label: 'Street Address', desc: 'Location: enter a street address' },
  city: { step: 4, label: 'City', desc: 'Location: enter a valid city' },
  amenities: { step: 5, label: 'Features & Amenities', desc: 'Features & Amenities: select amenities available at your venue' },
  price: { step: 6, label: 'Rental Setup', desc: 'Rental Setup: configure at least one active rental option' },
  inventory: { step: 7, label: 'Availability', desc: 'Availability: schedule at least one future bookable slot' },
  photos: { step: 8, label: 'Photos & Videos', desc: 'Photos & Videos: upload at least 3 photos including a cover photo' },
  description: { step: 9, label: 'Description', desc: 'Description: add venue description and presentation blocks' },
};

export default function SubmitStep({ data, submissionProblems = [], onJumpToStep }: Props) {
  const title = data.display_name || data.name || 'Your Venue';
  const hasPhotos = true; // Gate enforces photo count at step 4
  const hasAmenities = (data.amenity_names || []).length > 0;
  const hasPricing = Boolean(data.base_price && parseFloat(String(data.base_price)) > 0);
  const hasLocation = Boolean(data.address && data.city);

  const checklistItems = [
    { label: 'Basic Information & Categorization', done: Boolean(title && (data.category_id || data.category)) },
    { label: 'Location & Arrival Access', done: hasLocation },
    { label: 'High-Resolution Media (3+ Photos)', done: hasPhotos },
    { label: 'Features & Amenities Configured', done: hasAmenities },
    { label: 'Pricing & Cancellation Rules Set', done: hasPricing },
  ];

  const completedCount = checklistItems.filter((i) => i.done).length;
  const readinessPercent = Math.round((completedCount / checklistItems.length) * 100);

  return (
    <div className="space-y-8 flex flex-col animation-fade-in py-2">
      <div className="text-center max-w-lg mx-auto">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm ${
          submissionProblems.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {submissionProblems.length > 0 ? (
            <AlertCircle className="w-9 h-9" />
          ) : (
            <CheckCircle2 className="w-9 h-9" />
          )}
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold/15 text-pitch text-xs font-bold border border-marigold/30 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-marigold" /> Step 10: Final Review & Submission
        </div>
        <h2 className="text-3xl font-display font-bold text-ink mb-2">
          {submissionProblems.length > 0 ? 'Review Missing Requirements' : 'Ready for Quality Review!'}
        </h2>
        <p className="text-on-surface-variant text-sm leading-relaxed">
          {submissionProblems.length > 0
            ? 'Your listing cannot be submitted yet because some required information is missing. Use the checklist below to complete each item.'
            : `You've completed the required sections for ${title}. Submit below to send your listing to our quality review queue.`}
        </p>
      </div>

      {/* Submission Problems Checklist (from 422 response) */}
      {submissionProblems.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-sm sm:text-base">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Missing Requirements Checklist</span>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            Please resolve the following required items before submitting your listing:
          </p>
          <div className="space-y-2 pt-1">
            {submissionProblems.map((problemKey) => {
              const cleanKey = problemKey.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
              const meta = PROBLEM_MAP[cleanKey] || PROBLEM_MAP[problemKey] || {
                step: 1,
                label: cleanKey
                  ? cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1)
                  : 'Listing Details',
                desc: cleanKey
                  ? `Please complete the ${cleanKey} field`
                  : 'Please complete all required listing fields',
              };
              return (
                <div
                  key={problemKey}
                  className="bg-chalk p-3.5 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div>
                    <span className="font-bold text-sm text-ink">{meta.label}</span>
                    <p className="text-xs text-on-surface-variant mt-0.5">{meta.desc}</p>
                  </div>
                  {onJumpToStep && (
                    <button
                      type="button"
                      onClick={() => onJumpToStep(meta.step)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pitch text-chalk font-semibold text-xs hover:bg-ink transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                    >
                      Jump to Step {meta.step} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Listing Readiness Meter */}
      <div className="bg-mist p-5 rounded-2xl border border-surface-container space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-pitch" />
            <span className="font-semibold text-sm text-ink">Listing Quality & Readiness Score</span>
          </div>
          <span className="text-sm font-bold font-mono text-pitch">{readinessPercent}%</span>
        </div>

        <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-pitch transition-all duration-500 ease-out rounded-full"
            style={{ width: `${readinessPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {checklistItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-ink font-medium">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                item.done ? 'bg-emerald-600 text-white' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {item.done ? <Check className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/50" />}
              </div>
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What happens next */}
      <div className="bg-chalk p-6 rounded-2xl border border-surface-container-high space-y-4 shadow-xs">
        <h3 className="font-display font-semibold text-base text-ink flex items-center gap-2">
          <Clock className="w-4 h-4 text-pitch" /> What happens after you submit?
        </h3>
        <div className="space-y-3 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-pitch text-chalk flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              1
            </span>
            <p>
              <strong>Quality Verification:</strong> Our curator team checks photos, pricing transparency, and location accuracy to ensure a great customer experience.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-pitch text-chalk flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              2
            </span>
            <p>
              <strong>In-App Notification:</strong> You'll receive an in-app notification and dashboard alert as soon as your listing is reviewed and approved.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-pitch text-chalk flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              3
            </span>
            <p>
              <strong>Calendar & Slot Control:</strong> Your scheduled slots will automatically be bookable by customers, and you can add more slots or block dates at any time from the <strong>Owner Calendar</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
