import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { ListingFormData } from './ListingBuilder';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
}

export default function CategoryStep({ data, update }: Props) {
  // We use our newly injected API endpoints from Phase E!
  const { data: categories = [] } = useQuery({
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

  const filteredVenueTypes = venueTypes.filter((vt: any) => vt.category_id === data.category_id);
  const filteredUseCases = useCases;

  // When category changes, reset venue type and use cases
  const handleCategorySelect = (categoryId: string) => {
    update({ category_id: categoryId, venue_type_id: undefined, use_case_ids: [] });
  };

  const handleUseCaseToggle = (ucId: string) => {
    const current = data.use_case_ids || [];
    if (current.includes(ucId)) {
      update({ use_case_ids: current.filter(id => id !== ucId) });
    } else {
      update({ use_case_ids: [...current, ucId] });
    }
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-2">What kind of space is this?</h2>
        <p className="text-on-surface-variant">Select the categories that best describe your venue.</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-ink mb-3">Primary Category</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`p-4 border rounded-xl text-left transition-all ${
                  data.category_id === cat.id 
                    ? 'border-pitch bg-primary-container/10 ring-1 ring-pitch text-pitch' 
                    : 'border-surface-container-highest hover:border-pitch hover:bg-mist'
                }`}
              >
                <div className="font-medium">{cat.name}</div>
              </button>
            ))}
          </div>
        </div>

        {data.category_id && filteredVenueTypes.length > 0 && (
          <div className="animation-fade-in">
            <label className="block text-sm font-medium text-ink mb-3">Venue Type</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredVenueTypes.map((vt: any) => (
                <button
                  key={vt.id}
                  onClick={() => update({ venue_type_id: vt.id })}
                  className={`p-3 border rounded-lg text-sm text-left transition-all ${
                    data.venue_type_id === vt.id 
                      ? 'border-pitch bg-pitch text-chalk' 
                      : 'border-surface-container-highest hover:border-pitch'
                  }`}
                >
                  {vt.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {data.category_id && filteredUseCases.length > 0 && (
          <div className="animation-fade-in">
            <label className="block text-sm font-medium text-ink mb-3">Suitable For (Select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {filteredUseCases.map((uc: any) => {
                const isSelected = (data.use_case_ids || []).includes(uc.id);
                return (
                  <button
                    key={uc.id}
                    onClick={() => handleUseCaseToggle(uc.id)}
                    className={`px-4 py-2 border rounded-full text-sm transition-all ${
                      isSelected 
                        ? 'border-marigold bg-marigold/10 text-ink font-medium' 
                        : 'border-surface-container-highest text-on-surface-variant hover:border-marigold'
                    }`}
                  >
                    {uc.name}
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
