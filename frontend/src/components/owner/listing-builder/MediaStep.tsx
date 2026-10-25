import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ownerApi } from '../../../lib/api/owner';
import { ApiError } from '../../../lib/api/client';
import type { VenueImage } from '../../../lib/api/types';
import { SafeImage } from '../../dashboard';
import { useToast } from '../../ui/Toast';
import {
  UploadCloud,
  Image as ImageIcon,
  Video,
  X,
  Star,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
} from 'lucide-react';

interface Props {
  venueId: string | null;
  onComplete: () => void;
  onPhotoCountChange?: (count: number) => void;
}

export interface UploadItem {
  id: string;
  file: File;
  duration?: number | null;
  status: 'uploading' | 'done' | 'failed';
  error?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/webm',
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const MIN_VIDEO_DURATION_SEC = 10;
const MAX_VIDEO_DURATION_SEC = 90; // 1 min 30 sec

export function getVideoDuration(file: File): Promise<number | null> {
  if ((file as any).mockDuration !== undefined) {
    return Promise.resolve((file as any).mockDuration);
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  // In jsdom or testing environment without explicit mockDuration, don't block
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('jsdom')) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const url = URL.createObjectURL(file);
      video.src = url;

      let resolved = false;
      const cleanUp = () => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
          video.removeAttribute('src');
          video.load();
        }
      };

      video.onloadedmetadata = () => {
        const dur = video.duration;
        cleanUp();
        resolve(Number.isFinite(dur) ? dur : null);
      };

      video.onerror = () => {
        cleanUp();
        resolve(null);
      };

      setTimeout(() => {
        cleanUp();
        resolve(null);
      }, 3000);
    } catch {
      resolve(null);
    }
  });
}

function isVideoUrl(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.mp4') || clean.endsWith('.webm');
}

export default function MediaStep({ venueId, onComplete, onPhotoCountChange }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaList, setMediaList] = useState<VenueImage[]>([]);
  const [activeUploads, setActiveUploads] = useState<UploadItem[]>([]);
  const [videoLinkInput, setVideoLinkInput] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Count photos excluding videos
  const photoCount = mediaList.filter(m => !isVideoUrl(m.url) && (m as any).media_type !== 'video').length;
  const videoCount = mediaList.filter(m => isVideoUrl(m.url) || (m as any).media_type === 'video').length;

  const handleAddVideoLink = async () => {
    const trimmed = videoLinkInput.trim();
    if (!trimmed || !venueId) return;
    if (videoCount >= 3) {
      toast.error('Maximum 3 videos allowed per venue');
      return;
    }
    setIsAddingLink(true);
    try {
      await ownerApi.addVideoLink(venueId, { url: trimmed });
      const refreshed = await ownerApi.getVenue(venueId);
      setMediaList(refreshed.media || []);
      setVideoLinkInput('');
      toast.success('Video link added successfully');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.detail : err?.message || 'Failed to add video link';
      toast.error(msg);
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleMoveMedia = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= mediaList.length || !venueId) return;
    const nextList = [...mediaList];
    const temp = nextList[index];
    nextList[index] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    setMediaList(nextList);

    try {
      await ownerApi.reorderMedia(venueId, nextList.map((m) => m.id));
    } catch (err) {
      console.error('Failed to reorder media', err);
    }
  };

  // Load existing media on mount / venueId change
  useEffect(() => {
    if (!venueId) return;

    let isMounted = true;
    setIsLoading(true);

    ownerApi.getVenue(venueId)
      .then(venue => {
        if (!isMounted) return;
        const media = venue.media || [];
        setMediaList(media);
        const count = media.filter(m => !isVideoUrl(m.url)).length;
        onPhotoCountChange?.(count);
      })
      .catch(err => {
        console.error('Failed to load venue media', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [venueId, onPhotoCountChange]);

  // Upload a single file with computed isCover flag
  const uploadSingleFile = useCallback(
    async (file: File, isCover: boolean, duration?: number): Promise<boolean> => {
      if (!venueId) return false;
      const res = duration !== undefined
        ? await ownerApi.uploadVenueMedia(venueId, file, isCover, duration)
        : await ownerApi.uploadVenueMedia(venueId, file, isCover);
      const updatedMedia = res.media || [];
      setMediaList(updatedMedia);
      const count = updatedMedia.filter(m => !isVideoUrl(m.url)).length;
      onPhotoCountChange?.(count);
      return true;
    },
    [venueId, onPhotoCountChange]
  );

  // Validate a file before sending
  const validateFile = (file: File, duration?: number | null): string | null => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return `"${file.name}": Unsupported format (${file.type || 'unknown'}). Allowed formats: JPEG, PNG, MP4, WebM.`;
    }
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && file.size > MAX_IMAGE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return `"${file.name}": Image exceeds 10 MB limit (${sizeMb} MB).`;
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return `"${file.name}": Video exceeds 100 MB limit (${sizeMb} MB).`;
    }
    if (isVideo && duration !== undefined && duration !== null) {
      if (duration < MIN_VIDEO_DURATION_SEC) {
        return `"${file.name}": Video duration is too short (${Math.round(duration)}s). Minimum video duration is 10 seconds.`;
      }
      if (duration > MAX_VIDEO_DURATION_SEC) {
        return `"${file.name}": Video duration is too long (${Math.round(duration)}s). Maximum video duration is 1 minute 30 seconds (90s).`;
      }
    }
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !venueId) return;
    const files = Array.from(e.target.files);
    // Reset file input so selecting the same file again triggers change
    if (fileInputRef.current) fileInputRef.current.value = '';

    const newUploadItems: UploadItem[] = [];
    const validItems: { item: UploadItem; file: File; duration?: number }[] = [];

    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      let duration: number | null = null;
      if (isVideo && ALLOWED_MIME_TYPES.has(file.type)) {
        duration = await getVideoDuration(file);
      }
      const errorMsg = validateFile(file, duration);
      const itemId = Math.random().toString(36).slice(2, 9);
      if (errorMsg) {
        newUploadItems.push({
          id: itemId,
          file,
          duration,
          status: 'failed',
          error: errorMsg,
        });
      } else {
        const item: UploadItem = {
          id: itemId,
          file,
          duration,
          status: 'uploading',
        };
        newUploadItems.push(item);
        validItems.push({ item, file, duration: duration ?? undefined });
      }
    }

    setActiveUploads(prev => [...prev, ...newUploadItems]);

    if (validItems.length === 0) return;

    setIsUploading(true);

    // Compute whether venue already has a cover before starting the loop
    let hasCover = mediaList.some(m => m.is_cover);

    for (const { item, file, duration } of validItems) {
      const isVideo = file.type.startsWith('video/');
      const shouldBeCover = !hasCover && !isVideo;

      try {
        await uploadSingleFile(file, shouldBeCover, duration);
        if (shouldBeCover) {
          hasCover = true;
        }
        setActiveUploads(prev =>
          prev.map(u => (u.id === item.id ? { ...u, status: 'done' } : u))
        );
      } catch (err: any) {
        console.error('Failed to upload', file.name, err);
        const serverMsg =
          err instanceof ApiError ? err.detail : err?.message || 'Upload failed';
        setActiveUploads(prev =>
          prev.map(u =>
            u.id === item.id
              ? { ...u, status: 'failed', error: `"${file.name}": ${serverMsg}` }
              : u
          )
        );
      }
    }

    setIsUploading(false);
  };

  const handleRetry = async (itemId: string) => {
    const target = activeUploads.find(u => u.id === itemId);
    if (!target || !venueId) return;

    let duration = target.duration;
    if (duration === undefined && target.file.type.startsWith('video/') && ALLOWED_MIME_TYPES.has(target.file.type)) {
      duration = await getVideoDuration(target.file);
    }

    // Check client validation first
    const clientErr = validateFile(target.file, duration);
    if (clientErr) {
      setActiveUploads(prev =>
        prev.map(u => (u.id === itemId ? { ...u, error: clientErr, duration } : u))
      );
      return;
    }

    // Set to uploading
    setActiveUploads(prev =>
      prev.map(u => (u.id === itemId ? { ...u, status: 'uploading', error: undefined, duration } : u))
    );

    const isVideo = target.file.type.startsWith('video/');
    const hasCover = mediaList.some(m => m.is_cover);
    const shouldBeCover = !hasCover && !isVideo;

    try {
      await uploadSingleFile(target.file, shouldBeCover, duration ?? undefined);
      setActiveUploads(prev =>
        prev.map(u => (u.id === itemId ? { ...u, status: 'done' } : u))
      );
      toast.success(`"${target.file.name}" uploaded successfully`);
    } catch (err: any) {
      const serverMsg =
        err instanceof ApiError ? err.detail : err?.message || 'Retry failed';
      setActiveUploads(prev =>
        prev.map(u =>
          u.id === itemId
            ? { ...u, status: 'failed', error: `"${target.file.name}": ${serverMsg}` }
            : u
        )
      );
    }
  };

  const handleDismissUpload = (itemId: string) => {
    setActiveUploads(prev => prev.filter(u => u.id !== itemId));
  };

  const handleDelete = async (mediaItem: VenueImage) => {
    if (!venueId) return;
    const confirmed = window.confirm('Are you sure you want to remove this media?');
    if (!confirmed) return;

    try {
      await ownerApi.deleteVenueImage(venueId, mediaItem.id);
      // Refetch venue to get refreshed media and any promoted cover
      const refreshed = await ownerApi.getVenue(venueId);
      const updatedMedia = refreshed.media || [];
      setMediaList(updatedMedia);
      const count = updatedMedia.filter(m => !isVideoUrl(m.url)).length;
      onPhotoCountChange?.(count);
      toast.success('Media removed successfully');
    } catch (err: any) {
      console.error('Failed to delete media', err);
      const msg = err instanceof ApiError ? err.detail : err?.message || 'Failed to remove media';
      toast.error(msg);
    }
  };

  const handleSetCover = async (mediaItem: VenueImage) => {
    if (!venueId || mediaItem.is_cover) return;

    try {
      await ownerApi.setVenueCoverImage(venueId, mediaItem.id);
      const refreshed = await ownerApi.getVenue(venueId);
      setMediaList(refreshed.media || []);
      toast.success('Cover photo updated');
    } catch (err: any) {
      console.error('Failed to set cover image', err);
      const msg = err instanceof ApiError ? err.detail : err?.message || 'Failed to set cover photo';
      toast.error(msg);
    }
  };

  if (!venueId) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        Please complete the previous steps to save the draft before uploading media.
      </div>
    );
  }

  const failedUploads = activeUploads.filter(u => u.status === 'failed');
  const inProgressUploads = activeUploads.filter(u => u.status === 'uploading');

  return (
    <div className="space-y-6 flex flex-col animation-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold/15 text-pitch text-xs font-bold border border-marigold/30 mb-3">
            <ImageIcon className="w-3.5 h-3.5 text-pitch" /> Step 8: Photos & Videos
          </div>
          <h2 className="text-2xl font-display font-semibold text-ink mb-1">Showcase your venue</h2>
          <p className="text-sm text-on-surface-variant">
            Add at least 3 photos (up to 10 MB each). Videos: max 100 MB, 10s to 1m 30s duration (MP4/WebM).
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 shadow-2xs ${
              photoCount >= 3
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            {photoCount >= 3 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}
            Photos: {photoCount}/15 (min 3)
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-mist text-ink border border-surface-container whitespace-nowrap shrink-0 shadow-2xs">
            <Video className="w-3.5 h-3.5 text-pitch shrink-0" />
            Videos: {videoCount}/3
          </span>
        </div>
      </div>

      {/* Upload Status / Error Banner */}
      {failedUploads.length > 0 && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Some files could not be uploaded
          </div>
          <div className="space-y-2">
            {failedUploads.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs text-rose-800 bg-rose-100/60 p-2.5 rounded-lg"
              >
                <span className="flex-1 mr-2 break-all">{item.error}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRetry(item.id)}
                    className="flex items-center gap-1 font-semibold text-rose-900 hover:text-rose-950 underline text-xs"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissUpload(item.id)}
                    className="p-1 text-rose-700 hover:text-rose-900 rounded"
                    aria-label="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In-progress Upload Indicator */}
      {inProgressUploads.length > 0 && (
        <div role="status" className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3 text-xs text-blue-900 font-medium">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span>Uploading {inProgressUploads.length} file{inProgressUploads.length > 1 ? 's' : ''}...</span>
        </div>
      )}

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {mediaList.map((media, index) => {
          const isVideo = isVideoUrl(media.url) || (media as any).media_type === 'video';

          return (
            <div
              key={media.id}
              className="relative aspect-video bg-mist rounded-xl overflow-hidden border border-surface-container-highest group"
            >
              {isVideo ? (
                <video
                  src={media.url}
                  className="w-full h-full object-cover"
                  controls
                  preload="metadata"
                />
              ) : (
                <SafeImage
                  src={media.url}
                  className="w-full h-full object-cover"
                  alt="Venue photo"
                />
              )}

              {/* Cover badge */}
              {media.is_cover && !isVideo && (
                <div className="absolute top-2 left-2 bg-chalk/95 text-pitch px-2 py-1 rounded text-xs font-semibold backdrop-blur-sm shadow-sm flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  Cover Photo
                </div>
              )}

              {/* Video badge */}
              {isVideo && (
                <div className="absolute bottom-2 left-2 bg-chalk/90 text-pitch px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm shadow-sm flex items-center gap-1">
                  <Video className="w-3 h-3" /> Tour Video
                </div>
              )}

              {/* Action overlay */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {!media.is_cover && !isVideo && (
                  <button
                    type="button"
                    onClick={() => handleSetCover(media)}
                    title="Set as Cover Photo"
                    className="bg-chalk/95 hover:bg-chalk p-1.5 rounded-full text-pitch shadow-sm transition-colors cursor-pointer"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(media)}
                  title="Remove media"
                  aria-label="Remove media"
                  className="bg-chalk/95 hover:bg-error hover:text-chalk p-1.5 rounded-full text-error shadow-sm transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Reordering Controls */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-chalk/90 rounded-lg p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleMoveMedia(index, -1)}
                  disabled={index === 0}
                  title="Move backward"
                  className="p-1 hover:bg-mist rounded text-ink disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveMedia(index, 1)}
                  disabled={index === mediaList.length - 1}
                  title="Move forward"
                  className="p-1 hover:bg-mist rounded text-ink disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Upload Trigger Card */}
        <label
          className={`aspect-video bg-mist hover:bg-surface-container-highest transition-colors rounded-xl border-2 border-dashed border-surface-container-highest flex flex-col items-center justify-center cursor-pointer ${
            isUploading || photoCount >= 15 ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          <div className="flex gap-2 text-on-surface-variant mb-2">
            <ImageIcon className="w-5 h-5" />
            <Video className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium text-pitch">
            {isUploading ? 'Uploading...' : 'Upload Media'}
          </span>
          <span className="text-xs text-on-surface-variant mt-1 text-center px-2">
            Photos ≤ 10 MB • Videos ≤ 100 MB (10s – 1m 30s)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/jpeg,image/png,video/mp4,video/webm"
            onChange={handleFileSelect}
            disabled={isUploading || photoCount >= 15}
          />
        </label>
      </div>

      {/* Video Link Integration Box */}
      <div className="p-4 rounded-xl border border-surface-container bg-chalk space-y-3">
        <div className="flex items-center gap-2 text-ink font-semibold text-xs sm:text-sm">
          <LinkIcon className="w-4 h-4 text-pitch" />
          <span>Or add a video link (YouTube or Vimeo)</span>
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            value={videoLinkInput}
            onChange={(e) => setVideoLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddVideoLink();
              }
            }}
            placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
            className="flex-1 rounded-xl border border-surface-container-highest px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-pitch"
          />
          <button
            type="button"
            onClick={handleAddVideoLink}
            disabled={isAddingLink || !videoLinkInput.trim() || videoCount >= 3}
            className="px-4 py-2 bg-pitch text-chalk rounded-xl text-xs font-semibold hover:bg-ink transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isAddingLink ? 'Adding...' : 'Add Video'}
          </button>
        </div>
        <p className="text-2xs text-on-surface-variant">
          Save storage & bandwidth by embedding high-quality external video tours. Maximum 3 videos allowed.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4 text-xs text-on-surface-variant">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading venue media...
        </div>
      )}
    </div>
  );
}
