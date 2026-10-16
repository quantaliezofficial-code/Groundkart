import React, { useState } from 'react';
import { ListingFormData } from './ListingBuilder';
import { Sparkles, Building, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
}

const SPACE_ENVIRONMENTS = [
  { id: 'indoor', label: 'Indoor', desc: 'Enclosed, climate controlled hall or studio' },
  { id: 'outdoor', label: 'Outdoor', desc: 'Open lawn, turf ground, or open-air space' },
  { id: 'rooftop', label: 'Rooftop / Terrace', desc: 'Elevated venue with panoramic sky views' },
  { id: 'covered', label: 'Covered / Semi-Outdoor', desc: 'Canopy, pavilion, or semi-covered ground' },
];

export default function IdentityStep({ data, update }: Props) {
  const [showInternalName, setShowInternalName] = useState(Boolean(data.name && data.name !== data.display_name));

  // Keep name synced with display_name by default if not set separately
  const handleDisplayNameChange = (val: string) => {
    update({
      display_name: val,
      name: showInternalName ? data.name || val : val,
    });
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/10 text-pitch text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Step 1: Space Identity
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">Tell us about your venue</h2>
        <p className="text-on-surface-variant text-sm">
          Give guests a clear picture of what makes your space special, whether it's a sports turf, wedding banquet, conference room, or photo studio.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Public Venue Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={data.display_name || data.name || ''}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            className="w-full rounded-xl border border-surface-container-highest px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-pitch transition-all"
            placeholder="e.g. Skyline Arena, Royal Palms Banquet, Apex Conference Hub"
            required
          />
          <p className="text-xs text-on-surface-variant mt-1.5">
            This is the primary headline guests see across search results and booking pages.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Catchy Tagline
          </label>
          <div className="relative">
            <input
              type="text"
              value={data.tagline || ''}
              onChange={(e) => update({ tagline: e.target.value.slice(0, 60) })}
              className="w-full rounded-xl border border-surface-container-highest px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-pitch transition-all pr-16"
              placeholder="e.g. Where celebrations feel effortless & grand"
              maxLength={60}
            />
            <span className="absolute right-4 top-3.5 text-xs text-on-surface-variant/80 font-mono">
              {(data.tagline || '').length}/60
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1.5">
            A memorable one-liner displayed right below your venue title.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Space Environment
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SPACE_ENVIRONMENTS.map((env) => {
              const isSelected = (data as any).space_environment === env.id;
              return (
                <button
                  type="button"
                  key={env.id}
                  onClick={() => update({ ...data, space_environment: env.id } as any)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-pitch bg-primary-container/10 ring-1 ring-pitch text-pitch font-medium'
                      : 'border-surface-container-highest hover:border-pitch/50 hover:bg-mist text-ink'
                  }`}
                >
                  <span className="font-semibold text-sm">{env.label}</span>
                  <span className="text-xs text-on-surface-variant mt-0.5">{env.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold text-ink">
              Space Overview & Description <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-on-surface-variant">Recommended 80+ words</span>
          </div>
          <textarea
            value={data.description || ''}
            onChange={(e) => update({ description: e.target.value })}
            className="w-full rounded-xl border border-surface-container-highest p-4 text-ink focus:outline-none focus:ring-2 focus:ring-pitch min-h-[140px] text-sm leading-relaxed"
            placeholder="Share what makes this space standout. Mention the vibe, lighting, acoustics, ideal events, accessibility, or equipment provided..."
          />
          <div className="mt-2.5 p-3 rounded-lg bg-mist border border-surface-container flex items-start gap-2.5 text-xs text-on-surface-variant">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-pitch" />
            <span>
              <strong>Tip for high bookings:</strong> Mention key details like ceiling height, natural lighting, changing facilities, and whether outside vendors (catering/decor) are welcomed.
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-surface-container">
          <button
            type="button"
            onClick={() => setShowInternalName(!showInternalName)}
            className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-ink transition-colors"
          >
            {showInternalName ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showInternalName ? 'Hide internal management name' : 'Add internal management name (Optional)'}
          </button>
          {showInternalName && (
            <div className="mt-3 animation-fade-in">
              <label className="block text-xs font-medium text-ink mb-1">
                Internal Name / Branch Code
              </label>
              <input
                type="text"
                value={data.name || ''}
                onChange={(e) => update({ name: e.target.value })}
                className="w-full rounded-xl border border-surface-container-highest px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
                placeholder="e.g. Venue-Unit-04 or Court-A"
              />
              <p className="text-xs text-on-surface-variant mt-1">
                Only visible to you and your management team in the Owner Dashboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
