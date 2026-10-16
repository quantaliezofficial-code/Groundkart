import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { ListingFormData } from './ListingBuilder';
import { Layers, Check, Trophy, Heart, Briefcase, Camera, Users, Sparkles } from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
}

const CATEGORY_META: Record<string, { icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  'Sports & Fitness': { icon: Trophy, desc: 'Turfs, courts, grounds, swimming pools, fitness studios' },
  'Weddings & Celebrations': { icon: Heart, desc: 'Banquets, party lawns, farmhouses, marriage resorts' },
  'Weddings & Events': { icon: Heart, desc: 'Banquets, party lawns, farmhouses, marriage resorts' },
  'Corporate & Professional': { icon: Briefcase, desc: 'Conference centers, boardrooms, offsite halls, auditoriums' },
  'Corporate': { icon: Briefcase, desc: 'Conference centers, boardrooms, offsite halls, auditoriums' },
  'Shoots & Creative Spaces': { icon: Camera, desc: 'Photo studios, film sets, art galleries, creative sets' },
  'Social & Community': { icon: Users, desc: 'Community centers, clubhouses, dining & banquet halls' },
};

export default function CategoryStep({ data, update }: Props) {
  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<any[]>('/api/v1/categories'),
  });

  const { data: venueTypes = [] } = useQuery({
    queryKey: ['venue-types'],
    queryFn: () => api.get<any[]>('/api/v1/venue-types'),
  });

  const { data: useCases = [] } = useQuery({
    queryKey: ['use-cases'],
    queryFn: () => api.get<any[]>('/api/v1/use-cases'),
  });

  const filteredVenueTypes = venueTypes.filter(
    (vt: any) => vt.category_id === data.category_id
  );

  const handleCategorySelect = (cat: any) => {
    update({
      category_id: cat.id,
      category: cat.name,
      venue_type_id: undefined,
      use_case_ids: data.use_case_ids || [],
    });
  };

  const handleVenueTypeSelect = (vtId: string) => {
    update({ venue_type_id: vtId });
  };

  const handleUseCaseToggle = (ucId: string) => {
    const current = data.use_case_ids || [];
    if (current.includes(ucId)) {
      update({ use_case_ids: current.filter((id) => id !== ucId) });
    } else {
      update({ use_case_ids: [...current, ucId] });
    }
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/10 text-pitch text-xs font-semibold mb-3">
          <Layers className="w-3.5 h-3.5" /> Step 2: Categorization & Type
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">What kind of venue is this?</h2>
        <p className="text-on-surface-variant text-sm">
          Selecting the right category and space type ensures your listing appears in targeted customer searches and filters.
        </p>
      </div>

      <div className="space-y-7">
        {/* Primary Category Grid */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-3">
            Primary Venue Category <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {categories.map((cat: any) => {
              const isSelected = data.category_id === cat.id || data.category === cat.name;
              const meta = CATEGORY_META[cat.name] || { icon: Sparkles, desc: 'Specialized venue for events' };
              const IconComp = meta.icon;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat)}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                    isSelected
                      ? 'border-pitch bg-primary-container/15 ring-2 ring-pitch text-ink shadow-sm'
                      : 'border-surface-container-highest hover:border-pitch/50 hover:bg-mist text-ink'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-pitch text-chalk' : 'bg-surface-container-high text-pitch'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center justify-between">
                      <span>{cat.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-pitch shrink-0" />}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{meta.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Specific Venue Type */}
        {data.category_id && filteredVenueTypes.length > 0 && (
          <div className="pt-3 border-t border-surface-container animation-fade-in">
            <label className="block text-sm font-semibold text-ink mb-2.5">
              Specific Space Type <span className="text-rose-500">*</span>
            </label>
            <p className="text-xs text-on-surface-variant mb-3">
              Pinpoint the exact type of facility guests will be booking.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredVenueTypes.map((vt: any) => {
                const isSelected = data.venue_type_id === vt.id;
                return (
                  <button
                    type="button"
                    key={vt.id}
                    onClick={() => handleVenueTypeSelect(vt.id)}
                    className={`p-3 rounded-xl border text-sm text-left font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-pitch bg-pitch text-chalk shadow-xs'
                        : 'border-surface-container-highest hover:border-pitch/50 bg-chalk text-ink hover:bg-mist'
                    }`}
                  >
                    <span className="truncate">{vt.name}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Activities / Use Cases */}
        {useCases.length > 0 && (
          <div className="pt-3 border-t border-surface-container animation-fade-in">
            <label className="block text-sm font-semibold text-ink mb-1.5">
              Ideal Activities & Events (Select all that apply)
            </label>
            <p className="text-xs text-on-surface-variant mb-3">
              Help clients find you when they filter by purpose or event type.
            </p>
            <div className="flex flex-wrap gap-2">
              {useCases.map((uc: any) => {
                const isSelected = (data.use_case_ids || []).includes(uc.id);
                return (
                  <button
                    type="button"
                    key={uc.id}
                    onClick={() => handleUseCaseToggle(uc.id)}
                    className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-pitch text-chalk border border-pitch shadow-xs'
                        : 'border border-surface-container-highest text-ink hover:border-pitch/50 bg-mist hover:bg-surface-container-highest'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{uc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
