import React, { useState } from 'react';
import { useAdminVenues, useHomepagePlacements, useCreateHomepagePlacement, useDeleteHomepagePlacement, useReorderHomepageSection } from '../../hooks/useAdmin';
import { DashboardShell } from './DashboardShell';
import { Globe, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { ApiHomepagePlacement } from '../../lib/api/types';

export default function HomepageTab() {
  const [section, setSection] = useState<'featured' | 'trending' | 'popular' | 'recommended' | 'new'>('featured');
  const { data: placements, isLoading } = useHomepagePlacements(section);
  const { data: venues } = useAdminVenues();
  const createMutation = useCreateHomepagePlacement();
  const deleteMutation = useDeleteHomepagePlacement();
  const reorderMutation = useReorderHomepageSection();
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [badge, setBadge] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const handleAdd = () => {
    if (!selectedVenue) return;
    createMutation.mutate({
      venue_id: selectedVenue,
      section,
      priority: placements ? placements.length : 0,
      enabled: true,
      badge: badge || null,
      custom_title: customTitle || null,
      custom_description: customDesc || null
    });
    setSelectedVenue('');
    setBadge('');
    setCustomTitle('');
    setCustomDesc('');
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
    <DashboardShell
      title="Homepage Curation"
      navItems={[]}
      activeNavId=""
      description="Manage the venues that appear on the public homepage."

    >
      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        {['featured', 'trending', 'popular', 'recommended', 'new'].map(s => (
          <button
            key={s}
            onClick={() => setSection(s as any)}
            className={`px-4 py-2 rounded-full font-medium transition-colors ${
              section === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">Add Venue to {section.charAt(0).toUpperCase() + section.slice(1)}</h3>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <select
              value={selectedVenue}
              onChange={e => setSelectedVenue(e.target.value)}
              className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border"
            >
              <option value="">Select a venue...</option>
              {venues?.filter(v => v.status === 'active').map(v => (
                <option key={v.id} value={v.id} disabled={placements?.some(p => p.venue_id === v.id)}>
                  {v.name} ({v.city})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-4">
            <input type="text" placeholder="Badge (e.g. Top Pick)" value={badge} onChange={e => setBadge(e.target.value)} className="flex-1 rounded-lg border-gray-300 shadow-sm p-2 border text-sm" />
            <input type="text" placeholder="Custom Title Override" value={customTitle} onChange={e => setCustomTitle(e.target.value)} className="flex-1 rounded-lg border-gray-300 shadow-sm p-2 border text-sm" />
            <input type="text" placeholder="Custom Description" value={customDesc} onChange={e => setCustomDesc(e.target.value)} className="flex-1 rounded-lg border-gray-300 shadow-sm p-2 border text-sm" />
            <button
              onClick={handleAdd}
              disabled={!selectedVenue || createMutation.isPending}
              className="bg-primary text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 font-medium"
            >
              <Plus size={18} /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading placements...</div>
        ) : placements?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No venues in this section yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {placements?.map((p, i) => (
              <li key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  {p.venue.cover_image_url ? (
                    <img src={p.venue.cover_image_url} alt={p.venue.name} className="w-16 h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">No img</div>
                  )}
                  <div>
                    <h4 className="font-bold">{p.venue.name}</h4>
                    <p className="text-sm text-gray-500">{p.venue.city} • Priority: {p.priority}</p>
                    {p.badge && <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{p.badge}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleMove(i, 'up')} disabled={i === 0 || reorderMutation.isPending} className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                    <ArrowUp size={18} />
                  </button>
                  <button onClick={() => handleMove(i, 'down')} disabled={i === placements.length - 1 || reorderMutation.isPending} className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                    <ArrowDown size={18} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending} className="p-2 text-red-400 hover:text-red-600 ml-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
