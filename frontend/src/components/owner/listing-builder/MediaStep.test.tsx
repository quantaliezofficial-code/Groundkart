import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MediaStep from './MediaStep';
import { ownerApi } from '../../../lib/api/owner';
import type { ApiVenue } from '../../../lib/api/types';

vi.mock('../../../lib/api/owner', () => ({
  ownerApi: {
    getVenue: vi.fn(),
    uploadVenueMedia: vi.fn(),
    deleteVenueImage: vi.fn(),
    setVenueCoverImage: vi.fn(),
  },
}));

const mockVenueWithMedia: ApiVenue = {
  id: 'venue-123',
  owner_id: 'owner-1',
  name: 'Arena One',
  display_name: null,
  tagline: null,
  slug: 'arena-one',
  address: '123 Test St',
  city: 'Lucknow',
  state: null,
  pincode: null,
  capacity: null,
  unit_type: 'hour',
  base_price: '1000',
  status: 'draft',
  rejection_reason: null,
  suspension_reason: null,
  avg_rating: '0',
  amenities: [],
  content_blocks: [],
  created_at: new Date().toISOString(),
  description: null,
  media: [
    { id: 'img-1', url: 'https://example.com/photo1.jpg', is_cover: true, sort_order: 0 },
    { id: 'img-2', url: 'https://example.com/photo2.jpg', is_cover: false, sort_order: 1 },
    { id: 'vid-1', url: 'https://example.com/tour.mp4', is_cover: false, sort_order: 2 },
  ],
};

describe('MediaStep component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restricts file input picker to allowed image and video formats', () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValueOnce({ ...mockVenueWithMedia, media: [] });

    render(<MediaStep venueId="venue-123" onComplete={() => {}} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.accept).toBe('image/jpeg,image/png,video/mp4,video/webm');
  });

  it('loads existing media on mount and reports photo count excluding videos', async () => {
    const onPhotoCountChange = vi.fn();
    vi.mocked(ownerApi.getVenue).mockResolvedValueOnce(mockVenueWithMedia);

    render(
      <MediaStep
        venueId="venue-123"
        onComplete={() => {}}
        onPhotoCountChange={onPhotoCountChange}
      />
    );

    await waitFor(() => {
      expect(ownerApi.getVenue).toHaveBeenCalledWith('venue-123');
    });

    // 2 photos + 1 video -> photo count is 2
    expect(onPhotoCountChange).toHaveBeenCalledWith(2);
    expect(screen.getByText('Photos: 2/3 required')).toBeInTheDocument();
    expect(screen.getByText('Cover Photo')).toBeInTheDocument();
    expect(screen.getByText('Tour Video')).toBeInTheDocument();
  });

  it('validates client-side and rejects invalid MIME types before calling upload', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValueOnce({ ...mockVenueWithMedia, media: [] });

    render(<MediaStep venueId="venue-123" onComplete={() => {}} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['gif content'], 'animation.gif', { type: 'image/gif' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Unsupported format/i)).toBeInTheDocument();
    });

    // Server upload was never called
    expect(ownerApi.uploadVenueMedia).not.toHaveBeenCalled();
  });

  it('validates client-side and rejects images over 10 MB', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValueOnce({ ...mockVenueWithMedia, media: [] });

    render(<MediaStep venueId="venue-123" onComplete={() => {}} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // 11 MB dummy file
    const oversizedFile = new File([new Uint8Array(11 * 1024 * 1024)], 'giant.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/exceeds 10 MB limit/i)).toBeInTheDocument();
    });

    expect(ownerApi.uploadVenueMedia).not.toHaveBeenCalled();
  });

  it('computes is_cover correctly: exactly one photo becomes cover during multi-select upload', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValueOnce({ ...mockVenueWithMedia, media: [] });

    const photo1 = new File(['jpg1'], 'p1.jpg', { type: 'image/jpeg' });
    const photo2 = new File(['jpg2'], 'p2.jpg', { type: 'image/jpeg' });
    const video = new File(['vid'], 'tour.mp4', { type: 'video/mp4' });

    // Mock upload responses
    vi.mocked(ownerApi.uploadVenueMedia).mockImplementation(async (_id, file, isCover) => {
      return {
        ...mockVenueWithMedia,
        media: [
          { id: Math.random().toString(), url: `https://example.com/${file.name}`, is_cover: isCover, sort_order: 0 },
        ],
      };
    });

    render(<MediaStep venueId="venue-123" onComplete={() => {}} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [photo1, photo2, video] } });

    await waitFor(() => {
      expect(ownerApi.uploadVenueMedia).toHaveBeenCalledTimes(3);
    });

    // First image -> is_cover = true
    expect(ownerApi.uploadVenueMedia).toHaveBeenNthCalledWith(1, 'venue-123', photo1, true);
    // Second image -> is_cover = false
    expect(ownerApi.uploadVenueMedia).toHaveBeenNthCalledWith(2, 'venue-123', photo2, false);
    // Video -> is_cover = false
    expect(ownerApi.uploadVenueMedia).toHaveBeenNthCalledWith(3, 'venue-123', video, false);
  });

  it('wires the remove button to deleteVenueImage route with confirmation', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValue(mockVenueWithMedia);
    vi.mocked(ownerApi.deleteVenueImage).mockResolvedValueOnce(undefined as any);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MediaStep venueId="venue-123" onComplete={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Photos: 2/3 required')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole('button', { name: /remove media/i });
    expect(removeButtons.length).toBe(3);

    fireEvent.click(removeButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove this media?');
    expect(ownerApi.deleteVenueImage).toHaveBeenCalledWith('venue-123', 'img-1');
  });
});
