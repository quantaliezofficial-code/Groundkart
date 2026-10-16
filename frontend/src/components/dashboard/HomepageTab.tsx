import React, { useState, useMemo } from 'react';
import { useAdminVenues, useHomepagePlacements, useCreateHomepagePlacement, useDeleteHomepagePlacement, useReorderHomepageSection } from '../../hooks/useAdmin';
import { Globe, Plus, Trash2, ArrowUp, ArrowDown, Search, CheckCircle2 } from 'lucide-react';

export default function HomepageTab() {
  const [section, setSection] = useState<'featured' | 'trending' | 'popular' | 'recommended' | 'new'>('featured');
  const { data: placements, isLoading: placementsLoading } = useHomepagePlacements(section);
  const { data: venues, isLoading: venuesLoading } = useAdminVenues();
  
  const createMutation = useCreateHomepagePlacement();
  const deleteMutation = useDeleteHomepagePlacement();
  const reorderMutation = useReorderHomepageSection();
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [badge, setBadge] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const activeVenues = useMemo(() => {
    return (venues || []).filter(v => v.status === 'active');
  }, [venues]);

  const placedIds = useMemo(() => {
    return new Set(placements?.map(p => p.venue_id) || []);
  }, [placements]);

  const availableVenues = useMemo(() => {
    return activeVenues.filter(v => 
      !placedIds.has(v.id) && 
      (v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.city.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [activeVenues, placedIds, searchQuery]);

  const handleAdd = () => {
    if (!selectedVenueId) return;
    createMutation.mutate({
      venue_id: selectedVenueId,
      section,
      priority: placements ? placements.length : 0,
      enabled: true,
      badge: badge || null,
      custom_title: customTitle || null,
      custom_description: customDesc || null
    }, {
      onSuccess: () => {
        setSelectedVenueId('');
        setBadge('');
        setCustomTitle('');
        setCustomDesc('');
      }
    });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!placements) return;
    const newPlacements = [...placements];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPlacements.length) return;
    
    // Swap
    const temp = newPlacements[index];
    newPlacements[index] = newPlacements[targetIndex];
    newPlacements[targetIndex] = temp;
    
    reorderMutation.mutate({
      section,
      ordered_ids: newPlacements.map(p => p.id)
    });
  };

  return (
    <div className="space-y-8">
      {/* Section Tabs */}
      <div className="flex gap-4 overflow-x-auto pb-2 border-b border-surface-container">
        {['featured', 'trending', 'popular', 'recommended', 'new'].map(s => (
          <button
            key={s}
            onClick={() => {
              setSection(s as any);
              setSelectedVenueId('');
            }}
            className={`px-4 py-3 font-medium transition-colors border-b-2 whitespace-nowrap ${
              section === s ? 'border-pitch text-pitch' : 'border-transparent text-on-surface-variant hover:text-ink hover:border-ink/20'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Left Column: Current Placements */}
        <div className="space-y-4">
          <h3 className="font-sans text-lg font-semibold text-ink">Active in {section.charAt(0).toUpperCase() + section.slice(1)}</h3>
          
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest overflow-hidden">
            {placementsLoading ? (
              <div className="p-12 text-center">
                <div className="shimmer h-8 w-48 mx-auto rounded-full mb-4" />
                <div className="shimmer h-24 w-full rounded-xl" />
              </div>
            ) : placements?.length === 0 ? (
              <div className="p-12 text-center">
                <Globe size={32} className="mx-auto mb-3 text-on-surface-variant opacity-50" />
                <p className="font-sans text-sm text-on-surface-variant">No venues featured in this section yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-container">
                {placements?.map((p, i) => (
                  <li key={p.id} className="p-4 flex items-center justify-between hover:bg-surface-container/30 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {p.venue.cover_image_url ? (
                        <img src={p.venue.cover_image_url} alt={p.venue.name} className="w-20 h-20 object-cover rounded-xl shadow-sm border border-surface-container" />
                      ) : (
                        <div className="w-20 h-20 bg-surface-container rounded-xl flex items-center justify-center text-on-surface-variant">
                          <Globe size={24} className="opacity-20" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-sans text-base font-semibold text-ink truncate">{p.custom_title || p.venue.name}</h4>
                        <p className="font-sans text-sm text-on-surface-variant truncate">{p.custom_description || p.venue.slug}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-sans text-xs font-medium text-on-surface-variant opacity-70">#{i + 1}</span>
                          {p.badge && <span className="rounded-full bg-info/10 px-2 py-0.5 font-sans text-xs font-medium text-info">{p.badge}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 pl-4">
                      <div className="flex flex-col gap-1 mr-2">
                        <button 
                          onClick={() => handleMove(i, 'up')} 
                          disabled={i === 0 || reorderMutation.isPending} 
                          className="p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-ink rounded-md disabled:opacity-30 transition-colors"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button 
                          onClick={() => handleMove(i, 'down')} 
                          disabled={i === placements.length - 1 || reorderMutation.isPending} 
                          className="p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-ink rounded-md disabled:opacity-30 transition-colors"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                      <button 
                        onClick={() => deleteMutation.mutate(p.id)} 
                        disabled={deleteMutation.isPending} 
                        className="p-2 text-clay hover:bg-clay/10 rounded-xl transition-colors"
                        title="Remove from section"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column: Add New */}
        <div className="space-y-4">
          <h3 className="font-sans text-lg font-semibold text-ink">Add to {section.charAt(0).toUpperCase() + section.slice(1)}</h3>
          
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5 space-y-5">
            {/* Venue Selection */}
            <div className="space-y-3">
              <label className="font-sans text-sm font-medium text-ink block">1. Select Venue</label>
              
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Search available venues..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl bg-surface-container py-2 pl-9 pr-4 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-pitch"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto no-scrollbar pt-1">
                {venuesLoading ? (
                  <div className="col-span-2 py-8 text-center text-sm text-on-surface-variant">Loading venues...</div>
                ) : availableVenues.length === 0 ? (
                  <div className="col-span-2 py-8 text-center text-sm text-on-surface-variant">No matching venues found.</div>
                ) : (
                  availableVenues.map(v => {
                    const isSelected = selectedVenueId === v.id;
                    const coverImg = v.media?.find(m => m.is_cover)?.url || v.media?.[0]?.url;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVenueId(v.id)}
                        className={`relative flex flex-col text-left overflow-hidden rounded-xl border transition-all ${
                          isSelected 
                            ? 'border-pitch ring-1 ring-pitch shadow-sm' 
                            : 'border-surface-container hover:border-ink/30'
                        }`}
                      >
                        <div className="h-20 w-full bg-surface-container relative">
                          {coverImg ? (
                            <img src={coverImg} alt={v.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-on-surface-variant opacity-30">
                              <Globe size={24} />
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 bg-pitch text-chalk rounded-full p-0.5">
                              <CheckCircle2 size={14} />
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="font-sans text-xs font-semibold text-ink truncate">{v.name}</p>
                          <p className="font-sans text-[10px] text-on-surface-variant truncate">{v.city}</p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Customization */}
            <div className={`space-y-4 transition-opacity ${selectedVenueId ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="h-px bg-surface-container w-full" />
              <label className="font-sans text-sm font-medium text-ink block">2. Customize (Optional)</label>
              
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Badge (e.g. Top Pick)" 
                  value={badge} 
                  onChange={e => setBadge(e.target.value)} 
                  className="w-full rounded-xl border border-surface-container bg-surface-container-lowest px-4 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:border-pitch focus:outline-none" 
                />
                <input 
                  type="text" 
                  placeholder="Custom Title Override" 
                  value={customTitle} 
                  onChange={e => setCustomTitle(e.target.value)} 
                  className="w-full rounded-xl border border-surface-container bg-surface-container-lowest px-4 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:border-pitch focus:outline-none" 
                />
                <textarea 
                  placeholder="Custom Description" 
                  value={customDesc} 
                  onChange={e => setCustomDesc(e.target.value)} 
                  rows={2}
                  className="w-full resize-none rounded-xl border border-surface-container bg-surface-container-lowest px-4 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:border-pitch focus:outline-none" 
                />
              </div>

              <button
                onClick={handleAdd}
                disabled={!selectedVenueId || createMutation.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-pitch py-2.5 font-sans text-sm font-medium text-chalk disabled:opacity-50 transition-opacity"
              >
                <Plus size={16} /> Add to Section
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
