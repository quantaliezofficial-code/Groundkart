import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { ListingFormData } from './ListingBuilder';
import {
  Layers,
  Check,
  Trophy,
  Heart,
  Briefcase,
  Camera,
  Users,
  Sparkles,
  AlertTriangle,
  Plus,
  Star,
  X,
} from 'lucide-react';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
}

interface CanonicalMeta {
  displayName: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CANONICAL_MAP: Record<string, CanonicalMeta> = {
  'sports & fitness': {
    displayName: 'Sports & Fitness',
    desc: 'Turfs, courts, grounds, swimming pools, fitness studios',
    icon: Trophy,
  },
  'weddings & celebrations': {
    displayName: 'Weddings & Celebrations',
    desc: 'Banquets, party lawns, farmhouses, marriage resorts',
    icon: Heart,
  },
  'weddings & events': {
    displayName: 'Weddings & Celebrations',
    desc: 'Banquets, party lawns, farmhouses, marriage resorts',
    icon: Heart,
  },
  'corporate & professional': {
    displayName: 'Corporate & Professional',
    desc: 'Conference centers, boardrooms, offsite halls, auditoriums',
    icon: Briefcase,
  },
  'corporate': {
    displayName: 'Corporate & Professional',
    desc: 'Conference centers, boardrooms, offsite halls, auditoriums',
    icon: Briefcase,
  },
  'shoots & creative spaces': {
    displayName: 'Shoots & Creative Spaces',
    desc: 'Photo studios, film sets, art galleries, creative sets',
    icon: Camera,
  },
  'social & community': {
    displayName: 'Social & Community',
    desc: 'Community centers, clubhouses, dining & banquet halls',
    icon: Users,
  },
};

interface CategoryGroup {
  displayName: string;
  primaryId: string;
  allIds: string[];
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function CategoryStep({ data, update }: Props) {
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [customSpaceTypeInput, setCustomSpaceTypeInput] = useState('');
  const [isAddingOtherSpace, setIsAddingOtherSpace] = useState(false);
  const [customPurposeInput, setCustomPurposeInput] = useState('');

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

  // Group and deduplicate categories (e.g. Corporate vs Corporate & Professional, Weddings & Celebrations vs Weddings & Events)
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const groupMap = new Map<string, CategoryGroup>();

    categories.forEach((cat: any) => {
      const lower = (cat.name || '').trim().toLowerCase();
      const meta = CANONICAL_MAP[lower] || {
        displayName: cat.name,
        desc: 'Specialized spaces & event venues',
        icon: Sparkles,
      };

      const key = meta.displayName.toLowerCase();
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          displayName: meta.displayName,
          primaryId: cat.id,
          allIds: [cat.id],
          desc: meta.desc,
          icon: meta.icon,
        });
      } else {
        const existing = groupMap.get(key)!;
        if (!existing.allIds.includes(cat.id)) {
          existing.allIds.push(cat.id);
        }
        if (cat.name === meta.displayName) {
          existing.primaryId = cat.id;
        }
      }
    });

    return Array.from(groupMap.values());
  }, [categories]);

  // Check if a category group is currently selected
  const isCategoryGroupSelected = (group: CategoryGroup) => {
    const selectedIds = new Set(data.category_ids || []);
    if (data.category_id) selectedIds.add(data.category_id);

    const selectedNames = new Set(data.categories || []);
    if (data.category) selectedNames.add(data.category);

    return (
      group.allIds.some((id) => selectedIds.has(id)) ||
      selectedNames.has(group.displayName)
    );
  };

  const selectedCategoryGroups = useMemo(() => {
    return categoryGroups.filter(isCategoryGroupSelected);
  }, [categoryGroups, data.category_ids, data.category_id, data.categories, data.category]);

  // All category IDs actively selected (including alias IDs)
  const allActiveCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    categoryGroups.forEach((g) => {
      if (isCategoryGroupSelected(g)) {
        g.allIds.forEach((id) => ids.add(id));
      }
    });
    if (ids.size === 0 && data.category_id) {
      ids.add(data.category_id);
    }
    return ids;
  }, [categoryGroups, data.category_ids, data.category_id, data.categories, data.category]);

  // Available space types for selected categories (deduplicated by name)
  const availableVenueTypes = useMemo(() => {
    if (allActiveCategoryIds.size === 0) return [];
    const seenNames = new Set<string>();
    const types: Array<{ id: string; name: string; category_id: string }> = [];

    venueTypes.forEach((vt: any) => {
      if (allActiveCategoryIds.has(vt.category_id)) {
        const norm = (vt.name || '').trim().toLowerCase();
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          types.push(vt);
        }
      }
    });

    return types;
  }, [venueTypes, allActiveCategoryIds]);

  // Selected space type IDs
  const selectedVenueTypeIds = useMemo(() => {
    const list = data.venue_type_ids || [];
    if (list.length > 0) return list;
    if (data.venue_type_id) return [data.venue_type_id];
    return [];
  }, [data.venue_type_ids, data.venue_type_id]);

  // Space types to display based on activeCategoryTab
  const displayedVenueTypes = useMemo(() => {
    if (activeCategoryTab === 'all') {
      return availableVenueTypes;
    }
    const targetGroup = selectedCategoryGroups.find((g) => g.displayName === activeCategoryTab);
    if (!targetGroup) return availableVenueTypes;
    return availableVenueTypes.filter((vt) => targetGroup.allIds.includes(vt.category_id));
  }, [activeCategoryTab, availableVenueTypes, selectedCategoryGroups]);

  // Synchronize category_id and venue_type_id so they never mismatch
  const syncTaxonomyUpdates = (
    nextVtIds: string[],
    explicitPrimaryVtId?: string,
    customCategoryIds?: string[],
    customCategoryNames?: string[]
  ) => {
    const catIds = customCategoryIds ?? (data.category_ids || []);
    const catNames = customCategoryNames ?? (data.categories || []);

    // Determine primary venue type id
    let primaryVtId = explicitPrimaryVtId;
    if (!primaryVtId) {
      if (data.venue_type_id && nextVtIds.includes(data.venue_type_id)) {
        primaryVtId = data.venue_type_id;
      } else {
        primaryVtId = nextVtIds.length > 0 ? nextVtIds[0] : undefined;
      }
    }

    // Look up the primary venue type to get its true parent category_id
    let primaryCatId: string | undefined;
    let primaryCatName: string | undefined;

    if (primaryVtId) {
      const foundVt = venueTypes.find((vt: any) => vt.id === primaryVtId);
      if (foundVt) {
        primaryCatId = foundVt.category_id;
        const foundCat = categories.find((c: any) => c.id === foundVt.category_id);
        primaryCatName = foundCat?.name || data.category;
      }
    }

    // If no primary venue type selected yet, fall back to first selected category
    if (!primaryCatId) {
      if (catIds.length > 0) {
        primaryCatId = catIds[0];
        primaryCatName = catNames[0];
      } else if (data.category_id) {
        primaryCatId = data.category_id;
        primaryCatName = data.category;
      }
    }

    update({
      venue_type_ids: nextVtIds,
      venue_type_id: primaryVtId,
      category_id: primaryCatId,
      category: primaryCatName,
      category_ids: catIds,
      categories: catNames,
    });
  };

  // Toggle category group selection
  const handleCategoryToggle = (group: CategoryGroup) => {
    const isSelected = isCategoryGroupSelected(group);
    let newGroups: CategoryGroup[];

    if (isSelected) {
      newGroups = categoryGroups.filter(
        (g) => isCategoryGroupSelected(g) && g.displayName !== group.displayName
      );
      if (activeCategoryTab === group.displayName) {
        setActiveCategoryTab('all');
      }
    } else {
      const currentlySelected = categoryGroups.filter((g) => isCategoryGroupSelected(g));
      newGroups = [...currentlySelected, group];
      setActiveCategoryTab('all');
    }

    const newCategoryIds = newGroups.flatMap((g) => g.allIds);
    const newCategoryNames = newGroups.map((g) => g.displayName);

    syncTaxonomyUpdates(selectedVenueTypeIds, undefined, newCategoryIds, newCategoryNames);
  };

  // Toggle space type selection
  const handleVenueTypeToggle = (vt: { id: string; name: string; category_id: string }) => {
    const isSelected = selectedVenueTypeIds.includes(vt.id);
    const nextIds = isSelected
      ? selectedVenueTypeIds.filter((id) => id !== vt.id)
      : [...selectedVenueTypeIds, vt.id];

    syncTaxonomyUpdates(nextIds);
  };

  // Set specific space as primary venue type
  const handleSetPrimary = (vtId: string) => {
    syncTaxonomyUpdates(selectedVenueTypeIds, vtId);
  };

  // Remove space type from selected list
  const handleRemovePredefined = (vtId: string) => {
    const nextIds = selectedVenueTypeIds.filter((id) => id !== vtId);
    syncTaxonomyUpdates(nextIds);
  };

  // Add custom space type ("Other" space type)
  const handleAddCustomSpaceType = () => {
    const trimmed = customSpaceTypeInput.trim();
    if (!trimmed) return;
    const currentCustom = data.custom_space_types || [];
    if (!currentCustom.includes(trimmed)) {
      update({ custom_space_types: [...currentCustom, trimmed] });
    }
    setCustomSpaceTypeInput('');
    setIsAddingOtherSpace(false);
  };

  const handleRemoveCustomSpaceType = (name: string) => {
    const currentCustom = data.custom_space_types || [];
    update({ custom_space_types: currentCustom.filter((s) => s !== name) });
  };

  // Full list of selected spaces (predefined venue types + custom spaces)
  const selectedSpacesList = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      categoryName: string;
      isPredefined: boolean;
      isPrimary: boolean;
    }> = [];

    // Predefined venue types
    selectedVenueTypeIds.forEach((id) => {
      const vt = venueTypes.find((t: any) => t.id === id);
      if (vt) {
        const group = categoryGroups.find((g) => g.allIds.includes(vt.category_id));
        const catName =
          group?.displayName || categories.find((c: any) => c.id === vt.category_id)?.name || 'Space';
        list.push({
          id: vt.id,
          name: vt.name,
          categoryName: catName,
          isPredefined: true,
          isPrimary: data.venue_type_id ? vt.id === data.venue_type_id : list.length === 0,
        });
      }
    });

    // Custom space types
    (data.custom_space_types || []).forEach((name: string) => {
      list.push({
        id: `custom-${name}`,
        name,
        categoryName: 'Custom Space',
        isPredefined: false,
        isPrimary: false,
      });
    });

    return list;
  }, [
    selectedVenueTypeIds,
    venueTypes,
    categoryGroups,
    categories,
    data.venue_type_id,
    data.custom_space_types,
  ]);

  // Use cases / purposes
  const handleUseCaseToggle = (ucId: string) => {
    const current = data.use_case_ids || [];
    if (current.includes(ucId)) {
      update({ use_case_ids: current.filter((id) => id !== ucId) });
    } else {
      update({ use_case_ids: [...current, ucId] });
    }
  };

  const handleAddCustomPurpose = () => {
    const trimmed = customPurposeInput.trim();
    if (!trimmed) return;
    const currentCustom = data.custom_purposes || [];
    if (!currentCustom.includes(trimmed)) {
      update({ custom_purposes: [...currentCustom, trimmed] });
    }
    setCustomPurposeInput('');
  };

  const handleRemoveCustomPurpose = (name: string) => {
    const currentCustom = data.custom_purposes || [];
    update({ custom_purposes: currentCustom.filter((c: string) => c !== name) });
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold/15 text-pitch text-xs font-bold border border-marigold/30 mb-3">
          <Layers className="w-3.5 h-3.5 text-pitch" /> Step 2: Categorization & Type
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">What kind of venue is this?</h2>
        <p className="text-on-surface-variant text-sm">
          Selecting your venue categories and space types ensures your listing appears in targeted customer searches and filters.
        </p>
      </div>

      <div className="space-y-7">
        {/* Category Selection Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-ink">
                Venue Categories (Select all that apply) <span className="text-rose-500">*</span>
              </label>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Choose one or more categories that represent what your space accommodates.
              </p>
            </div>
            {selectedCategoryGroups.length > 0 && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-marigold/20 text-pitch border border-marigold/40 whitespace-nowrap shrink-0">
                {selectedCategoryGroups.length} selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {categoryGroups.map((group) => {
              const isSelected = isCategoryGroupSelected(group);
              const IconComp = group.icon;
              return (
                <button
                  type="button"
                  key={group.displayName}
                  onClick={() => handleCategoryToggle(group)}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 cursor-pointer relative ${
                    isSelected
                      ? 'border-pitch bg-emerald-50/70 ring-2 ring-pitch text-ink shadow-sm'
                      : 'border-surface-container-highest hover:border-pitch/50 hover:bg-mist text-ink'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-pitch text-marigold shadow-xs' : 'bg-surface-container-high text-pitch'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="font-semibold text-sm">
                      {group.displayName}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{group.desc}</p>
                  </div>
                  <div
                    className={`absolute top-4 right-4 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-pitch border-pitch text-marigold'
                        : 'border-surface-container-highest bg-chalk'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Specific Space Types */}
        {allActiveCategoryIds.size > 0 && (
          <div className="pt-3 border-t border-surface-container animation-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-ink">
                  Specific Space Types (Select all that apply)
                </label>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Pinpoint all facility types guests can book at your venue.
                </p>
              </div>
              {selectedVenueTypeIds.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-marigold/20 text-pitch border border-marigold/40 whitespace-nowrap shrink-0">
                  {selectedVenueTypeIds.length} selected
                </span>
              )}
            </div>

            {/* Category Filter Tabs (when multiple categories are selected) */}
            {selectedCategoryGroups.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => setActiveCategoryTab('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategoryTab === 'all'
                      ? 'bg-pitch text-chalk shadow-2xs'
                      : 'bg-mist text-ink hover:bg-surface-container-highest border border-surface-container'
                  }`}
                >
                  All Selected ({availableVenueTypes.length})
                </button>
                {selectedCategoryGroups.map((group) => {
                  const count = availableVenueTypes.filter((vt) => group.allIds.includes(vt.category_id)).length;
                  return (
                    <button
                      type="button"
                      key={group.displayName}
                      onClick={() => setActiveCategoryTab(group.displayName)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        activeCategoryTab === group.displayName
                          ? 'bg-pitch text-chalk shadow-2xs'
                          : 'bg-mist text-ink hover:bg-surface-container-highest border border-surface-container'
                      }`}
                    >
                      {group.displayName} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Space Types Grid */}
            {displayedVenueTypes.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {displayedVenueTypes.map((vt) => {
                  const isSelected = selectedVenueTypeIds.includes(vt.id);
                  return (
                    <button
                      type="button"
                      key={vt.id}
                      onClick={() => handleVenueTypeToggle(vt)}
                      className={`p-3 rounded-xl border text-sm text-left font-medium transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'border-pitch bg-pitch text-chalk shadow-xs'
                          : 'border-surface-container-highest hover:border-pitch/50 bg-chalk text-ink hover:bg-mist'
                      }`}
                    >
                      <span className="truncate mr-1">{vt.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-marigold stroke-[2.5] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant italic py-2">
                No space types found for this category filter.
              </p>
            )}

            {/* SECTION: Selected Spaces & Facilities */}
            <div className="mt-4 p-4 rounded-2xl bg-mist/60 border border-surface-container space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-pitch stroke-[2.5]" /> Selected Spaces & Facilities
                  </h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Spaces added to this venue. The primary space type determines your main listing classification.
                  </p>
                </div>
                {selectedSpacesList.length > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-marigold/20 text-pitch border border-marigold/40 whitespace-nowrap shrink-0 shadow-2xs">
                    {selectedSpacesList.length} added
                  </span>
                )}
              </div>

              {selectedSpacesList.length > 0 ? (
                <div className="space-y-2">
                  {selectedSpacesList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-chalk border border-surface-container-highest shadow-2xs gap-3 hover:border-pitch/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            item.isPrimary ? 'bg-marigold/20 text-pitch' : 'bg-mist text-pitch'
                          }`}
                        >
                          {item.isPrimary ? (
                            <Star className="w-3.5 h-3.5 fill-marigold text-marigold" />
                          ) : (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          )}
                        </div>
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs sm:text-sm text-ink truncate">{item.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mist text-on-surface-variant border border-surface-container shrink-0">
                            {item.categoryName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.isPredefined &&
                          (item.isPrimary ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pitch bg-marigold/20 px-2 py-0.5 rounded-md border border-marigold/40">
                              <Star className="w-3 h-3 fill-marigold text-marigold" /> Primary
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(item.id)}
                              className="text-xs font-semibold text-pitch/80 hover:text-pitch hover:underline px-2 py-0.5 cursor-pointer"
                              title="Set as primary venue type"
                            >
                              Set Primary
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() =>
                            item.isPredefined
                              ? handleRemovePredefined(item.id)
                              : handleRemoveCustomSpaceType(item.name)
                          }
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          aria-label="Remove space type"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-dashed border-surface-container-highest bg-chalk/60 text-center">
                  <p className="text-xs text-on-surface-variant">
                    No spaces added yet. Click any space type above to add it to your venue.
                  </p>
                </div>
              )}
            </div>

            {/* Custom Space Types (Others) */}
            <div className="p-3.5 rounded-xl border border-dashed border-surface-container-highest bg-mist/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-marigold" /> Other space types not listed above?
                </span>
                {!isAddingOtherSpace && (
                  <button
                    type="button"
                    onClick={() => setIsAddingOtherSpace(true)}
                    className="text-xs font-bold text-pitch hover:text-ink hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add custom space
                  </button>
                )}
              </div>

              {isAddingOtherSpace && (
                <div className="flex gap-2 animation-fade-in">
                  <input
                    type="text"
                    value={customSpaceTypeInput}
                    onChange={(e) => setCustomSpaceTypeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSpaceType();
                      }
                    }}
                    placeholder="e.g. Drone Racing Arena, Pickleball Loft, Photo Loft"
                    className="flex-1 rounded-xl border border-surface-container-highest bg-chalk px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-marigold/70 focus:border-pitch"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSpaceType}
                    className="px-3.5 py-1.5 bg-pitch text-chalk rounded-xl text-xs font-semibold hover:bg-ink transition-colors cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingOtherSpace(false);
                      setCustomSpaceTypeInput('');
                    }}
                    className="px-2.5 py-1.5 text-xs text-on-surface-variant hover:text-ink cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
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
                    className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-pitch text-chalk border border-pitch shadow-xs'
                        : 'border border-surface-container-highest text-ink hover:border-pitch/50 bg-mist hover:bg-surface-container-highest'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-marigold stroke-[2.5]" />}
                    <span>{uc.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Add Custom Purpose Box */}
            <div className="mt-5 p-4 rounded-xl border border-surface-container bg-chalk space-y-3">
              <label className="block text-xs font-semibold text-ink">
                Add your own purpose
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPurposeInput}
                  onChange={(e) => setCustomPurposeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomPurpose();
                    }
                  }}
                  placeholder="e.g. Drone Racing, Kite Festival, Dog Show"
                  className="flex-1 rounded-xl border border-surface-container-highest px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-marigold/70 focus:border-pitch"
                />
                <button
                  type="button"
                  onClick={handleAddCustomPurpose}
                  className="px-4 py-2 bg-pitch hover:bg-ink text-chalk rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  Add Purpose
                </button>
              </div>

              {/* Custom purposes tags */}
              {(data.custom_purposes || []).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {(data.custom_purposes || []).map((cp: string) => (
                    <span
                      key={cp}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-marigold/15 text-pitch border border-marigold/30"
                    >
                      <Check className="w-3 h-3 text-pitch stroke-[2.5]" />
                      <span>{cp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomPurpose(cp)}
                        className="hover:text-rose-700 cursor-pointer ml-1 font-bold"
                        aria-label="Remove purpose"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Moderation notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> Custom purposes are submitted to GroundBooking admins for review and moderation before becoming visible to all public search filters.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
