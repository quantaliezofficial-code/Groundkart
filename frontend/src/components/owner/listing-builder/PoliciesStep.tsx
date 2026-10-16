import React, { useState } from 'react';
import { ListingFormData } from './ListingBuilder';
import { ShieldCheck, Plus, X, AlertCircle, FileText, Check } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

const CANCELLATION_POLICIES = [
  {
    id: 'flexible',
    title: 'Flexible',
    badge: 'Recommended for turfs & studios',
    desc: 'Full refund if cancelled at least 24 hours before start time.',
  },
  {
    id: 'moderate',
    title: 'Moderate',
    badge: 'Recommended for banquet halls & offsites',
    desc: 'Full refund up to 5 days before event; 50% refund thereafter.',
  },
  {
    id: 'strict',
    title: 'Strict',
    badge: 'Recommended for weddings & peak dates',
    desc: '50% refund up to 7 days before event; non-refundable within 7 days.',
  },
];

const PRESET_RULES = [
  { id: 'alcohol', label: 'Alcohol Allowed', defaultVal: false },
  { id: 'smoking', label: 'Smoking in Designated Zones Only', defaultVal: true },
  { id: 'music_curfew', label: 'Loud Music / DJ Allowed (with 10 PM curfew)', defaultVal: true },
  { id: 'outside_food', label: 'Outside Food & Catering Allowed', defaultVal: true },
  { id: 'pets', label: 'Pets Allowed on Premise', defaultVal: false },
  { id: 'cleanup', label: 'Guest / Organizer Must Handle Basic Cleanup', defaultVal: true },
];

export default function PoliciesStep({ data, update }: Props) {
  const [newRule, setNewRule] = useState('');

  // Extract or initialize rules from content_blocks or custom fields
  const rulesBlock = (data.content_blocks || []).find((b) => b.type === 'Rules' || b.type === 'rules');
  const existingRules: string[] = rulesBlock?.settings?.custom_rules || (data as any).custom_rules || [];
  const selectedPolicy = rulesBlock?.settings?.cancellation_policy || (data as any).cancellation_policy || 'flexible';
  const toggleStates: Record<string, boolean> = rulesBlock?.settings?.toggles || (data as any).rule_toggles || {
    alcohol: false,
    smoking: true,
    music_curfew: true,
    outside_food: true,
    pets: false,
    cleanup: true,
  };

  const syncSettings = (updatedPolicy: string, updatedToggles: Record<string, boolean>, updatedCustom: string[]) => {
    const blocks = [...(data.content_blocks || []).filter((b) => b.type !== 'Rules' && b.type !== 'rules')];
    blocks.push({
      type: 'Rules',
      title: 'House Rules & Cancellation Policy',
      subtitle: `Cancellation: ${updatedPolicy.toUpperCase()}`,
      body: updatedCustom.join('\n'),
      sort_order: 1,
      enabled: true,
      media_reference: null,
      settings: {
        cancellation_policy: updatedPolicy,
        toggles: updatedToggles,
        custom_rules: updatedCustom,
      },
    });

    update({
      ...data,
      content_blocks: blocks,
      cancellation_policy: updatedPolicy,
      rule_toggles: updatedToggles,
      custom_rules: updatedCustom,
    } as any);
  };

  const handlePolicySelect = (policyId: string) => {
    syncSettings(policyId, toggleStates, existingRules);
  };

  const handleToggleRule = (ruleId: string) => {
    const newToggles = { ...toggleStates, [ruleId]: !toggleStates[ruleId] };
    syncSettings(selectedPolicy, newToggles, existingRules);
  };

  const addCustomRule = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = newRule.trim();
    if (trimmed && !existingRules.includes(trimmed)) {
      const updated = [...existingRules, trimmed];
      syncSettings(selectedPolicy, toggleStates, updated);
      setNewRule('');
    }
  };

  const removeCustomRule = (rule: string) => {
    const updated = existingRules.filter((r) => r !== rule);
    syncSettings(selectedPolicy, toggleStates, updated);
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/10 text-pitch text-xs font-semibold mb-3">
          <ShieldCheck className="w-3.5 h-3.5" /> Step 7: Policies & House Rules
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">Set expectations for guests</h2>
        <p className="text-on-surface-variant text-sm">
          Transparent guidelines protect your property and prevent misunderstandings regarding cancellations, noise, or property care.
        </p>
      </div>

      <div className="space-y-6">
        {/* Cancellation Policy Selection */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Cancellation Policy <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-3">
            {CANCELLATION_POLICIES.map((policy) => {
              const isSelected = selectedPolicy === policy.id;
              return (
                <button
                  type="button"
                  key={policy.id}
                  onClick={() => handlePolicySelect(policy.id)}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between gap-4 ${
                    isSelected
                      ? 'border-pitch bg-primary-container/15 ring-2 ring-pitch text-ink shadow-xs'
                      : 'border-surface-container-highest hover:border-pitch/40 bg-chalk text-ink hover:bg-mist'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink">{policy.title}</span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                        {policy.badge}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{policy.desc}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border mt-0.5 transition-colors ${
                      isSelected ? 'border-pitch bg-pitch text-chalk' : 'border-surface-container-highest'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick House Rules Toggles */}
        <div className="pt-3 border-t border-surface-container">
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Key House Rules
          </label>
          <p className="text-xs text-on-surface-variant mb-3">
            Quickly toggle standard rules that apply to your space.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESET_RULES.map((rule) => {
              const isEnabled = toggleStates[rule.id] ?? rule.defaultVal;
              return (
                <button
                  type="button"
                  key={rule.id}
                  onClick={() => handleToggleRule(rule.id)}
                  className={`p-3 rounded-xl border text-xs text-left font-medium transition-all flex items-center justify-between gap-2 ${
                    isEnabled
                      ? 'border-emerald-600/40 bg-emerald-50/50 text-emerald-950 ring-1 ring-emerald-600/20'
                      : 'border-surface-container-highest bg-chalk text-on-surface-variant hover:bg-mist'
                  }`}
                >
                  <span>{rule.label}</span>
                  <div
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors relative shrink-0 ${
                      isEnabled ? 'bg-emerald-600' : 'bg-surface-container-high'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Rules List & Adder */}
        <div className="pt-3 border-t border-surface-container">
          <label className="block text-sm font-semibold text-ink mb-1.5">
            Custom Guidelines / Things to Know
          </label>
          <p className="text-xs text-on-surface-variant mb-2.5">
            Specify venue-specific requirements (e.g. footwear requirements, security deposit, generator diesel policy).
          </p>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={addCustomRule}
              className="flex-1 rounded-xl border border-surface-container-highest px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
              placeholder="e.g. Non-marking shoes mandatory on wooden badminton court..."
            />
            <button
              type="button"
              onClick={addCustomRule}
              className="px-4 py-2 bg-pitch hover:bg-ink text-chalk rounded-xl text-xs font-semibold transition-all flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {existingRules.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-xl bg-mist border border-surface-container">
              {existingRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs text-ink bg-chalk px-3 py-2 rounded-lg border border-surface-container-high"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-pitch shrink-0" />
                    {rule}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCustomRule(rule)}
                    className="text-on-surface-variant hover:text-rose-600 transition-colors p-1"
                    title="Remove rule"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
