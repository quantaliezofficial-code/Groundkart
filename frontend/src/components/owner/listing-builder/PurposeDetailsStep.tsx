import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { ownerApi } from '../../../lib/api/owner';
import { ListingFormData } from './ListingBuilder';
import { VenuePurpose, UnitType } from '../../../lib/api/types';
import { Target, ChevronDown, ChevronUp, Users, DollarSign, FileText, Check, AlertCircle } from 'lucide-react';

const MODE_LABELS: Record<UnitType, string> = {
  hour: 'Hourly',
  half_day: 'Half Day',
  full_day: 'Full Day',
};

function formatAllowedModes(modes: UnitType[]): string {
  if (!modes || modes.length === 0) return 'No rental modes selected';
  return modes.map((m) => MODE_LABELS[m] || m).join(', ');
}

function formatGuests(maxGuests: number | null | undefined, venueCapacity?: number | null): string {
  if (maxGuests && maxGuests > 0) {
    return `Up to ${maxGuests} guests`;
  }
  if (venueCapacity && venueCapacity > 0) {
    return `Standard capacity (${venueCapacity} guests)`;
  }
  return 'Standard venue capacity';
}

function formatPriceOverride(price: string | null | undefined): string | null {
  if (!price || !price.trim()) return null;
  const num = Number(price);
  if (!isNaN(num) && num > 0) {
    return `₹${num.toLocaleString('en-IN')}`;
  }
  return `₹${price}`;
}

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

export interface PurposeDraft {
  id?: string;
  use_case_id?: string | null;
  custom_name?: string | null;
  name: string;
  is_custom_approved?: boolean;
  description: string;
  max_guests: number | null;
  allowed_modes: UnitType[];
  price_override: string;
  rules: string;
  enabled: boolean;
}

export default function PurposeDetailsStep({ data, update, venueId }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [purposesList, setPurposesList] = useState<PurposeDraft[]>(() => (data as any).purpose_drafts || []);

  // Fetch catalogue use cases for reference
  const { data: catalogueUseCases = [] } = useQuery({
    queryKey: ['use-cases'],
    queryFn: () => api.get<any[]>('/api/v1/use-cases'),
  });

  // Load existing purposes from backend if venue exists, or preserve from data.purpose_drafts
  useEffect(() => {
    // If formData already holds preserved drafts, reconcile with currently selected use cases
    if ((data as any).purpose_drafts && (data as any).purpose_drafts.length > 0) {
      const existingDrafts: PurposeDraft[] = (data as any).purpose_drafts;
      const selectedIds = new Set(data.use_case_ids || []);
      const customList = (data as any).custom_purposes || [];

      // Check for any newly added use cases from Step 2
      const existingUcIds = new Set(existingDrafts.map((d) => d.use_case_id).filter(Boolean));
      const existingCustomNames = new Set(existingDrafts.map((d) => d.custom_name).filter(Boolean));

      let hasNew = false;
      const merged: PurposeDraft[] = [...existingDrafts];

      catalogueUseCases.forEach((uc: any) => {
        if (selectedIds.has(uc.id) && !existingUcIds.has(uc.id)) {
          hasNew = true;
          merged.push({
            use_case_id: uc.id,
            custom_name: null,
            name: uc.name,
            description: '',
            max_guests: data.capacity || null,
            allowed_modes: ['hour', 'half_day', 'full_day'],
            price_override: '',
            rules: '',
            enabled: true,
          });
        }
      });

      customList.forEach((cname: string) => {
        if (!existingCustomNames.has(cname)) {
          hasNew = true;
          merged.push({
            use_case_id: null,
            custom_name: cname,
            name: cname,
            is_custom_approved: false,
            description: '',
            max_guests: data.capacity || null,
            allowed_modes: ['hour', 'half_day', 'full_day'],
            price_override: '',
            rules: '',
            enabled: true,
          });
        }
      });

      setPurposesList(merged);
      if (hasNew) {
        update({ purpose_drafts: merged } as any);
      }
      return;
    }

    if (!venueId) {
      // Build from data.use_case_ids and custom_purposes
      const selectedIds = new Set(data.use_case_ids || []);
      const drafts: PurposeDraft[] = [];

      catalogueUseCases.forEach((uc: any) => {
        if (selectedIds.has(uc.id)) {
          drafts.push({
            use_case_id: uc.id,
            custom_name: null,
            name: uc.name,
            description: '',
            max_guests: data.capacity || null,
            allowed_modes: ['hour', 'half_day', 'full_day'],
            price_override: '',
            rules: '',
            enabled: true,
          });
        }
      });

      const customList = (data as any).custom_purposes || [];
      customList.forEach((cname: string) => {
        drafts.push({
          use_case_id: null,
          custom_name: cname,
          name: cname,
          is_custom_approved: false,
          description: '',
          max_guests: data.capacity || null,
          allowed_modes: ['hour', 'half_day', 'full_day'],
          price_override: '',
          rules: '',
          enabled: true,
        });
      });

      if (drafts.length > 0) {
        setPurposesList(drafts);
        update({ purpose_drafts: drafts } as any);
      }
      return;
    }

    ownerApi.listPurposes(venueId).then((existing) => {
      if (existing.length > 0) {
        const drafts: PurposeDraft[] = existing.map((p) => ({
          id: p.id,
          use_case_id: p.use_case_id,
          custom_name: p.custom_name,
          name: p.custom_name || p.name || 'Event Purpose',
          is_custom_approved: p.is_custom_approved,
          description: p.description || '',
          max_guests: p.max_guests,
          allowed_modes: p.allowed_modes || ['hour', 'full_day'],
          price_override: p.price_override || '',
          rules: p.rules || '',
          enabled: p.enabled,
        }));
        setPurposesList(drafts);
        update({ purpose_drafts: drafts } as any);
      } else {
        // Fallback to catalogue selected
        const selectedIds = new Set(data.use_case_ids || []);
        const drafts: PurposeDraft[] = [];

        catalogueUseCases.forEach((uc: any) => {
          if (selectedIds.has(uc.id)) {
            drafts.push({
              use_case_id: uc.id,
              custom_name: null,
              name: uc.name,
              description: '',
              max_guests: data.capacity || null,
              allowed_modes: ['hour', 'half_day', 'full_day'],
              price_override: '',
              rules: '',
              enabled: true,
            });
          }
        });

        const customList = (data as any).custom_purposes || [];
        customList.forEach((cname: string) => {
          drafts.push({
            use_case_id: null,
            custom_name: cname,
            name: cname,
            is_custom_approved: false,
            description: '',
            max_guests: data.capacity || null,
            allowed_modes: ['hour', 'half_day', 'full_day'],
            price_override: '',
            rules: '',
            enabled: true,
          });
        });

        setPurposesList(drafts);
        if (drafts.length > 0) {
          update({ purpose_drafts: drafts } as any);
        }
      }
    }).catch(err => console.error('Failed to load purposes', err));
  }, [venueId, data.use_case_ids, (data as any).custom_purposes, (data as any).purpose_drafts, catalogueUseCases]);

  const updatePurposeItem = async (index: number, patch: Partial<PurposeDraft>) => {
    const nextList = [...purposesList];
    nextList[index] = { ...nextList[index], ...patch };
    setPurposesList(nextList);
    update({ purpose_drafts: nextList } as any);

    // Save to venue if draft exists
    const item = nextList[index];
    if (venueId) {
      try {
        if (item.id) {
          await ownerApi.updatePurpose(venueId, item.id, {
            description: item.description,
            max_guests: item.max_guests,
            allowed_modes: item.allowed_modes,
            price_override: item.price_override || null,
            rules: item.rules,
            enabled: item.enabled,
          });
        } else {
          const created = await ownerApi.createPurpose(venueId, {
            use_case_id: item.use_case_id,
            custom_name: item.custom_name,
            description: item.description,
            max_guests: item.max_guests,
            allowed_modes: item.allowed_modes,
            price_override: item.price_override || null,
            rules: item.rules,
            enabled: item.enabled,
          });
          nextList[index].id = created.id;
          setPurposesList([...nextList]);
          update({ purpose_drafts: [...nextList] } as any);
        }
      } catch (e) {
        console.error('Failed to save purpose', e);
      }
    }
  };

  const toggleMode = (index: number, mode: UnitType) => {
    const item = purposesList[index];
    const current = item.allowed_modes || [];
    const nextModes = current.includes(mode)
      ? current.filter((m) => m !== mode)
      : [...current, mode];

    if (nextModes.length === 0) return; // Must keep at least one mode
    updatePurposeItem(index, { allowed_modes: nextModes });
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold/15 text-pitch text-xs font-bold border border-marigold/30 mb-3">
          <Target className="w-3.5 h-3.5 text-pitch" /> Step 3: Purpose Details
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">Configure details for each event type</h2>
        <p className="text-on-surface-variant text-sm">
          Specify guest limits, allowed rental durations, custom rules, and dedicated prices for the events your venue can host.
        </p>
      </div>

      {purposesList.length === 0 ? (
        <div className="p-8 rounded-2xl border border-surface-container bg-mist text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <p className="text-sm font-semibold text-ink">No purposes selected yet</p>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            You can tick ideal event types in Step 2 to configure specific guest limits and rules here, or proceed with general venue settings.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {purposesList.map((item, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-surface-container-highest bg-chalk shadow-xs overflow-hidden transition-all"
              >
                {/* Header Card */}
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? -1 : idx)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-mist/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-pitch text-marigold flex items-center justify-center font-bold text-sm shadow-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm sm:text-base">{item.name}</span>
                        {item.custom_name && !item.is_custom_approved && (
                          <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-marigold/15 text-pitch border border-marigold/30">
                            Custom • Pending Review
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant mt-0.5">
                        <span className="font-medium text-pitch/80">
                          {formatAllowedModes(item.allowed_modes)}
                        </span>
                        <span className="text-on-surface-variant/40">•</span>
                        <span>{formatGuests(item.max_guests, data.capacity)}</span>
                        {formatPriceOverride(item.price_override) && (
                          <>
                            <span className="text-on-surface-variant/40">•</span>
                            <span className="font-semibold text-pitch">
                              {formatPriceOverride(item.price_override)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-on-surface-variant" /> : <ChevronDown className="w-5 h-5 text-on-surface-variant" />}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-5 border-t border-surface-container bg-chalk space-y-5 animation-fade-in">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Purpose Description
                      </label>
                      <textarea
                        value={item.description}
                        onChange={(e) => updatePurposeItem(idx, { description: e.target.value })}
                        rows={2}
                        placeholder={`Tell guests how your venue caters to ${item.name}...`}
                        className="w-full rounded-xl border border-surface-container-highest p-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-marigold/70 focus:border-pitch"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-on-surface-variant" /> Maximum Guests for this Event
                        </label>
                        <input
                          type="number"
                          value={item.max_guests ?? ''}
                          onChange={(e) => updatePurposeItem(idx, { max_guests: e.target.value ? parseInt(e.target.value, 10) : null })}
                          placeholder="e.g. 250"
                          min={1}
                          className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-marigold/70 focus:border-pitch"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-on-surface-variant" /> Price Override (Optional)
                        </label>
                        <input
                          type="number"
                          value={item.price_override}
                          onChange={(e) => updatePurposeItem(idx, { price_override: e.target.value })}
                          placeholder="Leave blank to use base rate"
                          min={0}
                          className="w-full rounded-xl border border-surface-container-highest px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-marigold/70 focus:border-pitch"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1.5">
                        Allowed Rental Modes
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(['hour', 'half_day', 'full_day'] as UnitType[]).map((mode) => {
                          const isTicked = item.allowed_modes.includes(mode);
                          const label = MODE_LABELS[mode] || mode;
                          return (
                            <button
                              type="button"
                              key={mode}
                              onClick={() => toggleMode(idx, mode)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isTicked
                                  ? 'bg-pitch text-chalk shadow-xs'
                                  : 'bg-mist text-on-surface-variant border border-surface-container hover:border-pitch/40'
                              }`}
                            >
                              {isTicked && <Check className="w-3 h-3 text-marigold stroke-[2.5]" />}
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-on-surface-variant" /> Rules & Requirements for {item.name}
                      </label>
                      <textarea
                        value={item.rules}
                        onChange={(e) => updatePurposeItem(idx, { rules: e.target.value })}
                        rows={2}
                        placeholder="e.g. Music cutoff at 10 PM; Outside catering allowed with prior notice."
                        className="w-full rounded-xl border border-surface-container-highest p-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-marigold/70 focus:border-pitch"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
