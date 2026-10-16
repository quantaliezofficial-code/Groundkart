import React, { useState } from 'react';
import { ListingFormData } from './ListingBuilder';
import { Plus, GripVertical, Trash2, Image as ImageIcon } from 'lucide-react';
import { VenueContentBlock } from '../../../lib/api/types';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

const BLOCK_TYPES = [
  'Text', 'Text + Image', 'Image + Text', 'Image Gallery', 'Video',
  'Feature Grid', 'Highlights', 'FAQ', 'Quote', 'Callout', 'Checklist',
  'Venue Story', 'Suitable For', 'Things to Know', 'Rules'
];

export default function PresentationStep({ data, update, venueId }: Props) {
  const blocks = data.content_blocks || [];
  
  const addBlock = (type: string) => {
    const newBlock: any = { type, sort_order: blocks.length, enabled: true };
    update({ content_blocks: [...blocks, newBlock] });
  };

  const updateBlock = (index: number, updates: any) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    update({ content_blocks: newBlocks });
  };

  const removeBlock = (index: number) => {
    const newBlocks = [...blocks];
    newBlocks.splice(index, 1);
    update({ content_blocks: newBlocks });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= blocks.length) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    
    // Update sort_order
    newBlocks.forEach((b, i) => b.sort_order = i);
    update({ content_blocks: newBlocks });
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-2">Build your presentation</h2>
        <p className="text-on-surface-variant">Add custom sections to tell your venue's story exactly how you want.</p>
      </div>

      <div className="space-y-6">
        {blocks.map((block, i) => (
          <div key={i} className="border border-surface-container-highest rounded-xl p-6 bg-chalk relative group">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move flex flex-col gap-2">
              <button onClick={() => moveBlock(i, -1)} disabled={i === 0} className="p-1 hover:bg-mist rounded text-on-surface-variant disabled:opacity-30">↑</button>
              <GripVertical className="w-4 h-4 text-on-surface-variant mx-auto" />
              <button onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} className="p-1 hover:bg-mist rounded text-on-surface-variant disabled:opacity-30">↓</button>
            </div>
            
            <button 
              onClick={() => removeBlock(i)}
              className="absolute right-4 top-4 p-2 text-on-surface-variant hover:text-error transition-colors rounded-full hover:bg-mist"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="ml-6 mr-8 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-1 bg-surface-container-highest text-ink text-xs font-medium rounded-md uppercase tracking-wider">
                  {block.type}
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Title</label>
                <input
                  type="text"
                  value={block.title || ''}
                  onChange={e => updateBlock(i, { title: e.target.value })}
                  className="w-full rounded-lg border border-surface-container-highest px-4 py-2 focus:ring-2 focus:ring-pitch"
                  placeholder="Section title (optional)"
                />
              </div>

              {(['Text', 'Text + Image', 'Image + Text', 'Quote', 'Callout', 'Venue Story'].includes(block.type)) && (
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Body Text</label>
                  <textarea
                    value={block.body || ''}
                    onChange={e => updateBlock(i, { body: e.target.value })}
                    className="w-full rounded-lg border border-surface-container-highest px-4 py-2 focus:ring-2 focus:ring-pitch min-h-[100px]"
                    placeholder="Enter the content for this section..."
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border border-dashed border-surface-container-highest rounded-xl p-8 text-center bg-mist/50">
        <h3 className="text-sm font-medium text-ink mb-4">Add a new section</h3>
        <div className="flex flex-wrap justify-center gap-2">
          {BLOCK_TYPES.map(type => (
            <button
              key={type}
              onClick={() => addBlock(type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-surface-container-highest bg-chalk hover:border-pitch hover:text-pitch transition-colors text-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
