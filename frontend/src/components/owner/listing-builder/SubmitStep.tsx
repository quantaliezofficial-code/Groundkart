import React from 'react';
import { ListingFormData } from './ListingBuilder';
import { CheckCircle2, ShieldCheck, Clock, Bell, Sparkles, Check, ArrowRight } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

export default function SubmitStep({ data, update, venueId }: Props) {
  const title = data.display_name || data.name || 'Your Venue';
  const hasPhotos = true; // guaranteed by MediaStep gate
  const hasAmenities = (data.amenity_names || []).length > 0;
  const hasPricing = Boolean(data.base_price && parseFloat(String(data.base_price)) > 0);
  const hasLocation = Boolean(data.address && data.city);

  const checklistItems = [
    { label: 'Basic Information & Categorization', done: Boolean(title && data.category) },
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
        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/10 text-pitch text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" /> Step 9: Final Review & Submission
        </div>
        <h2 className="text-3xl font-display font-bold text-ink mb-2">
          Your listing is ready for review!
        </h2>
        <p className="text-on-surface-variant text-sm leading-relaxed">
          You've completed all required sections for <strong>{title}</strong>. Click submit below to send your listing to our onboarding quality team.
        </p>
      </div>

      {/* Listing Readiness Meter */}
      <div className="bg-mist p-5 rounded-2xl border border-surface-container space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-pitch" />
            <span className="font-semibold text-sm text-ink">Listing Quality & Verification Score</span>
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
              <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
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
              <strong>Fast Verification:</strong> Our curator team checks photos, pricing transparency, and location accuracy (usually completed in under 24 hours).
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-pitch text-chalk flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              2
            </span>
            <p>
              <strong>Instant Notification:</strong> You'll receive a confirmation alert as soon as your venue is approved and live on the marketplace.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-pitch text-chalk flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              3
            </span>
            <p>
              <strong>Calendar & Slot Control:</strong> You can immediately manage your booking slots, blackout maintenance dates, and view revenue payouts in the <strong>Owner Dashboard</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
