import React, { useState } from 'react';
import { ApiAdminVenueView } from '../../lib/api/types';
import { X, Star, MapPin, Image as ImageIcon } from 'lucide-react';
import { useSetVenueCoverImage, useDeleteVenueImage } from '../../hooks/useAdmin';
import { SafeImage } from './index';

interface Props {
  venue: ApiAdminVenueView;
  onClose: () => void;
}

export function AdminVenueDrawer({ venue, onClose }: Props) {
  const setCover = useSetVenueCoverImage();
  const deleteImg = useDeleteVenueImage();
  const [activeTab, setActiveTab] = useState<'info' | 'images'>('info');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{venue.name}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <MapPin size={14} /> {venue.city}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 bg-gray-50 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Venue Information
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'images' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Images Gallery
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Status</div>
                  <div className="font-bold text-gray-900">{venue.status}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Category</div>
                  <div className="font-bold text-gray-900">{venue.category}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Base Price</div>
                  <div className="font-bold text-gray-900">{venue.base_price} / {venue.unit_type}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Owner</div>
                  <div className="font-bold text-gray-900">{venue.owner_name}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {venue.description || 'No description provided.'}
                </p>
              </div>

              {venue.amenities && venue.amenities.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {venue.amenities.map(a => (
                      <span key={a} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div>
              {venue.images && venue.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {venue.images.map(img => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-video">
                      <SafeImage src={img.url} alt="Venue image" className="w-full h-full object-cover" />
                      
                      {img.is_cover && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                          <Star size={12} fill="currentColor" /> Primary
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        {!img.is_cover && (
                          <button
                            onClick={() => setCover.mutate({ venueId: venue.id, imageId: img.id })}
                            disabled={setCover.isPending}
                            className="bg-white text-gray-900 px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-gray-100 disabled:opacity-50"
                          >
                            Set as Primary
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this image?')) {
                              deleteImg.mutate({ venueId: venue.id, imageId: img.id });
                            }
                          }}
                          disabled={deleteImg.isPending}
                          className="text-white hover:text-red-400 text-sm font-medium underline"
                        >
                          Delete Image
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-12 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                  <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No images uploaded for this venue.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
