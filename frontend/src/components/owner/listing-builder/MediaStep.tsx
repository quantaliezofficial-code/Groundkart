import React, { useState } from 'react';
import { ownerApi } from '../../../lib/api/owner';
import { UploadCloud, Image as ImageIcon, Video, X } from 'lucide-react';

interface Props {
  venueId: string | null;
  onComplete: () => void;
}

export default function MediaStep({ venueId, onComplete }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploads, setUploads] = useState<{ url: string; type: 'image' | 'video' }[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !venueId) return;
    
    setIsUploading(true);
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      const isVideo = file.type.startsWith('video/');
      const isCover = uploads.length === 0 && !isVideo; // First image becomes cover
      
      try {
        await ownerApi.uploadVenueMedia(venueId, file, isCover);
        // Optimistic UI update (mock URL since we'd normally refetch the venue)
        setUploads(prev => [...prev, { url: URL.createObjectURL(file), type: isVideo ? 'video' : 'image' }]);
      } catch (err) {
        console.error('Failed to upload', file.name, err);
      }
    }
    setIsUploading(false);
  };

  if (!venueId) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        Please complete the previous steps to save the draft before uploading media.
      </div>
    );
  }

  return (
    <div className="space-y-8 flex flex-col animation-fade-in">
      <div>
        <h2 className="text-2xl font-display font-semibold text-ink mb-2">Showcase your venue</h2>
        <p className="text-on-surface-variant">Add at least 3 photos. You can also add a venue tour video (MP4/WebM).</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {uploads.map((media, i) => (
          <div key={i} className="relative aspect-video bg-mist rounded-xl overflow-hidden border border-surface-container-highest group">
            {media.type === 'video' ? (
              <video src={media.url} className="w-full h-full object-cover" />
            ) : (
              <img src={media.url} className="w-full h-full object-cover" alt="" />
            )}
            {i === 0 && media.type === 'image' && (
              <div className="absolute top-2 left-2 bg-chalk/90 px-2 py-1 rounded text-xs font-medium backdrop-blur-sm shadow-sm">
                Cover Photo
              </div>
            )}
            <button className="absolute top-2 right-2 bg-chalk/90 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-error hover:bg-error hover:text-chalk shadow-sm">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        
        <label className="aspect-video bg-mist hover:bg-surface-container-highest transition-colors rounded-xl border-2 border-dashed border-surface-container-highest flex flex-col items-center justify-center cursor-pointer">
          <div className="flex gap-2 text-on-surface-variant mb-2">
            <ImageIcon className="w-5 h-5" />
            <Video className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium text-pitch">{isUploading ? 'Uploading...' : 'Upload Media'}</span>
          <input 
            type="file" 
            className="hidden" 
            multiple 
            accept="image/*,video/mp4,video/webm"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </label>
      </div>
    </div>
  );
}
