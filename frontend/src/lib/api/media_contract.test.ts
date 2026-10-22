import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ownerApi } from './owner';
import { adminApi } from './admin';

describe('Media API Contract', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ownerApi.uploadVenueMedia sends POST to /images with form field image and is_cover', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(JSON.stringify({ id: 'venue-123', media: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const file = new File(['dummy content'], 'photo.jpg', { type: 'image/jpeg' });
    await ownerApi.uploadVenueMedia('venue-123', file, true);

    expect(capturedUrl).toContain('/api/v1/venues/venue-123/images');
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.body).toBeInstanceOf(FormData);

    const formData = capturedInit?.body as FormData;
    expect(formData.get('image')).toBe(file);
    expect(formData.get('is_cover')).toBe('true');
  });

  it('adminApi.setVenueCoverImage sends PATCH to /images/{id}/cover with no body', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(JSON.stringify({ id: 'img-456', is_cover: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await adminApi.setVenueCoverImage('venue-123', 'img-456');

    expect(capturedUrl).toContain('/api/v1/venues/venue-123/images/img-456/cover');
    expect(capturedInit?.method).toBe('PATCH');
  });

  it('adminApi.deleteVenueImage sends DELETE to /images/{id}', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(null, { status: 204 });
    });

    await adminApi.deleteVenueImage('venue-123', 'img-456');

    expect(capturedUrl).toContain('/api/v1/venues/venue-123/images/img-456');
    expect(capturedInit?.method).toBe('DELETE');
  });

  it('ownerApi.setVenueCoverImage sends PATCH to /images/{id}/cover', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(JSON.stringify({ id: 'img-789', is_cover: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await ownerApi.setVenueCoverImage('venue-123', 'img-789');

    expect(capturedUrl).toContain('/api/v1/venues/venue-123/images/img-789/cover');
    expect(capturedInit?.method).toBe('PATCH');
  });

  it('ownerApi.deleteVenueImage sends DELETE to /images/{id}', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(null, { status: 204 });
    });

    await ownerApi.deleteVenueImage('venue-123', 'img-789');

    expect(capturedUrl).toContain('/api/v1/venues/venue-123/images/img-789');
    expect(capturedInit?.method).toBe('DELETE');
  });
});
