import React from 'react';
import { ListingFormData } from './ListingBuilder';
import { Plus, GripVertical, Trash2, Eye, EyeOff, Layout, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { VenueContentBlock } from '../../../lib/api/types';

interface Props {
  data: Partial<ListingFormData>;
  update: (data: Partial<ListingFormData>) => void;
  venueId?: string | null;
}

const TEMPLATE_BLOCKS = [
  { type: 'about', label: 'About', defaultTitle: 'About This Space', placeholder: 'Describe your venue in depth, including architecture, vibe, and host hospitality...' },
  { type: 'highlights', label: 'Highlights', defaultTitle: 'Key Highlights', placeholder: 'List the top features guests love (e.g., Floodlights, VIP Lounge, Private Parking)...' },
  { type: 'rules', label: 'Rules', defaultTitle: 'Venue Rules & Guidelines', placeholder: 'Specify noise cutoffs, outside vendor policies, and check-in requirements...' },
  { type: 'faq', label: 'FAQs', defaultTitle: 'Frequently Asked Questions', placeholder: 'Q: Is catering allowed?\nA: Yes, outside catering is welcomed with no extra corkage fees.' },
];

export default function PresentationStep({ data, update, venueId }: Props) {
  const blocks = data.content_blocks || [];

  const addBlock = (type: string, title?: string, placeholder?: string) => {
    const newBlock: any = {
      type,
      title: title || type,
      body: '',
      sort_order: blocks.length,
      enabled: true,
    };
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

  const toggleBlockVisibility = (index: number) => {
    const newBlocks = [...blocks];
    const currentEnabled = newBlocks[index].enabled !== false;
    newBlocks[index] = { ...newBlocks[index], enabled: !currentEnabled };
    update({ content_blocks: newBlocks });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= blocks.length) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;

    // Update sort_order
    newBlocks.forEach((b, i) => (b.sort_order = i));
    update({ content_blocks: newBlocks });
  };

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold/15 text-pitch text-xs font-bold border border-marigold/30 mb-3">
          <Layout className="w-3.5 h-3.5 text-pitch" /> Step 9: Description & Presentation
        </div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-1.5">Build your custom venue description</h2>
        <p className="text-on-surface-variant text-sm">
          Add sections to showcase your story, highlights, guidelines, and event-specific details. Reorder, edit, or hide blocks at any time.
        </p>
      </div>

      {/* Block List */}
      <div className="space-y-4">
        {blocks.map((block, i) => {
          const isEnabled = block.enabled !== false;
          return (
            <div
              key={i}
              className={`border rounded-2xl p-5 bg-chalk relative transition-all shadow-xs ${
                isEnabled ? 'border-surface-container-highest' : 'border-surface-container bg-mist/60 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-surface-container-highest text-ink text-xs font-bold rounded-lg uppercase tracking-wider">
                    {block.type}
                  </span>
                  {!isEnabled && (
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-mist text-on-surface-variant border border-surface-container">
                      Hidden from guests
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Reorder Buttons */}
                  <button
                    type="button"
                    onClick={() => moveBlock(i, -1)}
                    disabled={i === 0}
                    className="p-1.5 hover:bg-mist rounded-lg text-on-surface-variant disabled:opacity-30 cursor-pointer"
                    title="Move Up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(i, 1)}
                    disabled={i === blocks.length - 1}
                    className="p-1.5 hover:bg-mist rounded-lg text-on-surface-variant disabled:opacity-30 cursor-pointer"
                    title="Move Down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* Toggle Visibility */}
                  <button
                    type="button"
                    onClick={() => toggleBlockVisibility(i)}
                    className="p-1.5 hover:bg-mist rounded-lg text-on-surface-variant hover:text-ink cursor-pointer"
                    title={isEnabled ? 'Hide block' : 'Show block'}
                  >
                    {isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                  </button>

                  {/* Delete Block */}
                  <button
                    type="button"
                    onClick={() => removeBlock(i)}
                    className="p-1.5 text-on-surface-variant hover:text-rose-600 rounded-lg hover:bg-mist transition-colors cursor-pointer"
                    title="Delete section"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Section Title</label>
                  <input
                    type="text"
                    value={block.title || ''}
                    onChange={(e) => updateBlock(i, { title: e.target.value })}
                    className="w-full rounded-xl border border-surface-container-highest px-3.5 py-2 text-sm text-ink font-medium focus:ring-2 focus:ring-pitch focus:outline-none"
                    placeholder="e.g. Venue Highlights, Photography Guidelines"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Content / Body</label>
                  <textarea
                    value={block.body || ''}
                    onChange={(e) => updateBlock(i, { body: e.target.value })}
                    className="w-full rounded-xl border border-surface-container-highest p-3 text-xs text-ink focus:ring-2 focus:ring-pitch focus:outline-none min-h-[90px] leading-relaxed"
                    placeholder="Enter details for this section..."
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Section Templates */}
      <div className="border border-dashed border-surface-container-highest rounded-2xl p-6 text-center bg-mist/40 space-y-3">
        <h3 className="text-sm font-semibold text-ink flex items-center justify-center gap-1.5">
          <Sparkles className="w-4 h-4 text-pitch" /> Add a Content Section
        </h3>
        <p className="text-xs text-on-surface-variant">Click any template below to add a formatted block to your page:</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {TEMPLATE_BLOCKS.map((tpl) => (
            <button
              type="button"
              key={tpl.type}
              onClick={() => addBlock(tpl.type, tpl.defaultTitle, tpl.placeholder)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-container-highest bg-chalk hover:border-pitch hover:text-pitch transition-colors text-xs font-semibold shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-pitch" />
              {tpl.label} Block
            </button>
          ))}
          <button
            type="button"
            onClick={() => addBlock('custom', 'Additional Details')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-container-highest bg-chalk hover:border-pitch hover:text-pitch transition-colors text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-pitch" />
            Custom Block
          </button>
        </div>
      </div>
    </div>
  );
}
