import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListingBuilder from './ListingBuilder';
import { ownerApi } from '../../../lib/api/owner';
import { api, ApiError } from '../../../lib/api/client';
import { ToastProvider } from '../../ui/Toast';

vi.mock('../../../lib/api/owner', () => ({
  ownerApi: {
    getVenue: vi.fn(),
    createVenue: vi.fn(),
    updateVenue: vi.fn(),
    uploadVenueMedia: vi.fn(),
    deleteVenueImage: vi.fn(),
    listPurposes: vi.fn().mockResolvedValue([]),
    createPurpose: vi.fn().mockResolvedValue({ id: 'p1' }),
    updatePurpose: vi.fn().mockResolvedValue({}),
    deletePurpose: vi.fn().mockResolvedValue({}),
    listRentalOptions: vi.fn().mockResolvedValue([]),
    createRentalOption: vi.fn().mockResolvedValue({}),
    updateRentalOption: vi.fn().mockResolvedValue({}),
    deleteRentalOption: vi.fn().mockResolvedValue({}),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
    addInventoryUnits: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api/client')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('ListingBuilder Guide 10 Onboarding Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. loads an existing venue into the form and displays rejection_reason banner if present', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValue({
      id: 'venue-edit-1',
      owner_id: 'owner-1',
      name: 'Grand Pavilion',
      display_name: 'Grand Pavilion Arena',
      tagline: 'Premier celebration ground',
      slug: 'grand-pavilion',
      category: 'Sports & Fitness',
      category_id: 'cat-sports',
      venue_type_id: 'vt-cricket',
      use_case_ids: ['uc-tournaments'],
      address: '77 Residency Rd',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pincode: '226001',
      capacity: 500,
      unit_type: 'hour',
      base_price: '2500',
      status: 'draft',
      rejection_reason: 'Please upload higher resolution photos of the main turf.',
      suspension_reason: null,
      avg_rating: '0',
      amenities: ['Floodlights', 'Dressing Room'],
      content_blocks: [],
      created_at: new Date().toISOString(),
      description: 'A world-class sports arena.',
      media: [
        { id: 'm1', url: 'https://example.com/1.jpg', is_cover: true, sort_order: 0 },
        { id: 'm2', url: 'https://example.com/2.jpg', is_cover: false, sort_order: 1 },
        { id: 'm3', url: 'https://example.com/3.jpg', is_cover: false, sort_order: 2 },
      ],
    });

    renderWithProviders(
      <ListingBuilder venueId="venue-edit-1" onClose={() => {}} onComplete={() => {}} />
    );

    // Initial loading indicator is shown then resolved
    await waitFor(() => {
      expect(screen.queryByText(/loading venue listing/i)).not.toBeInTheDocument();
    });

    // Loaded title in header
    expect(screen.getByRole('heading', { name: /Grand Pavilion Arena/i })).toBeInTheDocument();

    // Rejection reason banner is displayed
    expect(screen.getByText(/Listing Revision Required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Please upload higher resolution photos of the main turf\./i)
    ).toBeInTheDocument();

    // Form input value is pre-populated
    const nameInput = screen.getByDisplayValue('Grand Pavilion Arena');
    expect(nameInput).toBeInTheDocument();
  });

  it('2. debounced autosave sends one merged PATCH request for rapid changes', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValue({
      id: 'venue-edit-2',
      owner_id: 'owner-1',
      name: 'Sprint Ground',
      display_name: 'Sprint Ground',
      tagline: 'Fast games',
      slug: 'sprint-ground',
      category: 'Sports & Fitness',
      address: '10 Speed Way',
      city: 'Lucknow',
      state: null,
      pincode: '226010',
      capacity: 50,
      unit_type: 'hour',
      base_price: '1500',
      status: 'draft',
      rejection_reason: null,
      suspension_reason: null,
      avg_rating: '0',
      amenities: [],
      content_blocks: [],
      created_at: new Date().toISOString(),
      description: null,
      media: [],
    });

    vi.mocked(ownerApi.updateVenue).mockResolvedValue({} as any);

    renderWithProviders(
      <ListingBuilder venueId="venue-edit-2" onClose={() => {}} onComplete={() => {}} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading venue listing/i)).not.toBeInTheDocument();
    });

    const taglineInput = screen.getByPlaceholderText(/Where celebrations feel effortless & grand/i);

    // Multiple rapid typing keystrokes
    fireEvent.change(taglineInput, { target: { value: 'Fast' } });
    fireEvent.change(taglineInput, { target: { value: 'Fast games' } });
    fireEvent.change(taglineInput, { target: { value: 'Fast games & tournaments' } });

    // updateVenue should NOT have been called yet (debounce in effect)
    expect(ownerApi.updateVenue).not.toHaveBeenCalled();

    // Fast-forward or advance to Step 2 which calls flushAutosave()
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    // updateVenue was called once with the final merged value
    expect(ownerApi.updateVenue).toHaveBeenCalledTimes(1);
    expect(ownerApi.updateVenue).toHaveBeenCalledWith(
      'venue-edit-2',
      expect.objectContaining({
        tagline: 'Fast games & tournaments',
      })
    );
  });

  it('3. blocks Next until each step has valid inputs with inline validation message', async () => {
    renderWithProviders(
      <ListingBuilder onClose={() => {}} onComplete={() => {}} />
    );

    // Step 1: Identity - empty name
    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Venue name is required/i);

    // Fill venue name
    const nameInput = screen.getByPlaceholderText(/Skyline Arena/i);
    fireEvent.change(nameInput, { target: { value: 'Apex Sports Club' } });

    // Step 1 now valid
    expect(nextBtn).not.toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Advance to Step 2: Category & Purposes
    fireEvent.click(nextBtn);
    await screen.findByText(/What kind of venue is this/i);

    // Step 2 has default category Sports & Fitness, so Next is enabled
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();

    // Advance to Step 3: Purpose Details
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Configure details for each event type/i);
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();

    // Advance to Step 4: Location
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Where is your space situated/i);

    // Step 4 initial location is empty
    const step4Next = screen.getByRole('button', { name: /next/i });
    expect(step4Next).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Street address and city are required/i);

    // Fill address only
    const addressInput = screen.getByPlaceholderText(/Plot No/i);
    fireEvent.change(addressInput, { target: { value: '12 Sector B' } });
    expect(step4Next).toBeDisabled();

    // Fill city
    const cityInput = screen.getByPlaceholderText(/e\.g\. Lucknow/i);
    fireEvent.change(cityInput, { target: { value: 'Lucknow' } });

    // Enter an invalid 3-digit pincode
    const pincodeInput = screen.getByPlaceholderText(/e\.g\. 226010/i);
    fireEvent.change(pincodeInput, { target: { value: '123' } });

    // Next is blocked with 6-digit pincode requirement
    expect(step4Next).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Pincode must be exactly 6 digits/i);

    // Correct pincode to valid 6 digits
    fireEvent.change(pincodeInput, { target: { value: '226010' } });
    expect(step4Next).not.toBeDisabled();
  });

  it('4. displays 422 submission problem checklist and jumps to matching step on click', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValue({
      id: 'venue-submit-test',
      owner_id: 'owner-1',
      name: 'Apex Sports Club',
      display_name: 'Apex Sports Club',
      tagline: 'Top arena',
      slug: 'apex-sports',
      category: 'Sports & Fitness',
      category_id: 'cat-1',
      address: '12 Sector B',
      city: 'Lucknow',
      state: null,
      pincode: '226010',
      capacity: 50,
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
        { id: '1', url: 'https://example.com/1.jpg', is_cover: true, sort_order: 0 },
        { id: '2', url: 'https://example.com/2.jpg', is_cover: false, sort_order: 1 },
        { id: '3', url: 'https://example.com/3.jpg', is_cover: false, sort_order: 2 },
      ],
    });

    // Mock updateVenue to fail with 422 and missing inventory
    const error422 = new ApiError(422, 'Listing cannot be submitted for review: missing inventory');
    error422.data = { code: 'incomplete', missing: ['inventory', 'photos'] };
    vi.mocked(ownerApi.updateVenue).mockRejectedValue(error422);

    renderWithProviders(
      <ListingBuilder venueId="venue-submit-test" onClose={() => {}} onComplete={() => {}} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading venue listing/i)).not.toBeInTheDocument();
    });

    // Advance through the steps to Step 9 (Submit)
    // Step 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/What kind of venue is this/i);

    // Step 2 -> 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Configure details for each event type/i);

    // Step 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Where is your space situated/i);

    // Step 4 -> 5 (Features & Amenities)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Space specs & facilities/i);

    // Step 5 -> 6 (Rental Setup)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/How would you like to rent your space/i);

    // Step 6 -> 7 (Availability)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Schedule bookable slots/i);

    // Step 7 -> 8 (Media)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Showcase your venue/i);

    // Step 8 -> 9 (Description)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Build your custom venue description/i);

    // Step 9 -> 10 (Submit)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Step 10: Final Review & Submission/i);

    // Click Submit for Review
    const submitBtn = screen.getByRole('button', { name: /submit for review/i });
    fireEvent.click(submitBtn);

    // Assert that the 422 checklist appears
    await screen.findByText(/Missing Requirements Checklist/i);
    expect(screen.getByText(/Availability: schedule at least one future bookable slot/i)).toBeInTheDocument();
    expect(screen.getByText(/Photos & Videos: upload at least 3 photos/i)).toBeInTheDocument();

    // Click "Jump to Step 7" (Availability)
    const jumpToStep7Btn = screen.getByRole('button', { name: /jump to step 7/i });
    fireEvent.click(jumpToStep7Btn);

    // Verifies the builder jumps straight back to Step 7
    await screen.findByText(/Step 7: Availability & Calendar/i);
    expect(screen.getByText(/Schedule bookable slots/i)).toBeInTheDocument();
  });

  it('5. handles FastAPI raw JSON 422 error detail with {"code":"incomplete","missing":["inventory"]} and cleanly maps to Availability (Step 7)', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValue({
      id: 'venue-fastapi-422',
      owner_id: 'owner-1',
      name: 'Grand Pavilion',
      display_name: 'Grand Pavilion Arena',
      tagline: 'Premier celebration ground',
      slug: 'grand-pavilion',
      category: 'Sports & Fitness',
      category_id: 'cat-sports',
      venue_type_id: 'vt-cricket',
      use_case_ids: ['uc-tournaments'],
      address: '77 Residency Rd',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pincode: '226001',
      capacity: 500,
      unit_type: 'hour',
      base_price: '2500',
      status: 'draft',
      rejection_reason: null,
      suspension_reason: null,
      avg_rating: '0',
      amenities: ['High-Speed Wi-Fi'],
      content_blocks: [],
      created_at: new Date().toISOString(),
      description: 'A world-class sports arena.',
      media: [
        { id: 'm1', url: 'https://example.com/1.jpg', is_cover: true, sort_order: 0 },
        { id: 'm2', url: 'https://example.com/2.jpg', is_cover: false, sort_order: 1 },
        { id: 'm3', url: 'https://example.com/3.jpg', is_cover: false, sort_order: 2 },
      ],
    });

    // Exact FastAPI detail structure as returned by backend HTTPException
    const error422 = new ApiError(422, '{"code":"incomplete","missing":["inventory"]}');
    error422.data = { detail: { code: 'incomplete', missing: ['inventory'] } };
    vi.mocked(ownerApi.updateVenue).mockRejectedValue(error422);

    renderWithProviders(
      <ListingBuilder venueId="venue-fastapi-422" onClose={() => {}} onComplete={() => {}} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading venue listing/i)).not.toBeInTheDocument();
    });

    // Advance to Step 10
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 1 -> 2
    await screen.findByText(/What kind of venue is this/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 2 -> 3
    await screen.findByText(/Configure details for each event type/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 3 -> 4
    await screen.findByText(/Where is your space situated/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 4 -> 5
    await screen.findByText(/Space specs & facilities/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 5 -> 6
    await screen.findByText(/How would you like to rent your space/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 6 -> 7
    await screen.findByText(/Schedule bookable slots/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 7 -> 8
    await screen.findByText(/Showcase your venue/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 8 -> 9
    await screen.findByText(/Build your custom venue description/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 9 -> 10

    await screen.findByText(/Step 10: Final Review & Submission/i);

    // Click Submit
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    // Assert that the checklist does NOT display `"` or `["inventory"]}`
    await screen.findByText(/Missing Requirements Checklist/i);
    expect(screen.queryByText('Please complete the " field')).not.toBeInTheDocument();
    expect(screen.queryByText('Please complete the ["inventory"]} field')).not.toBeInTheDocument();

    // Verify it cleanly renders Availability and Jump to Step 7
    expect(screen.getByText(/Availability: schedule at least one future bookable slot/i)).toBeInTheDocument();
    const jumpBtn = screen.getByRole('button', { name: /jump to step 7/i });
    expect(jumpBtn).toBeInTheDocument();
    fireEvent.click(jumpBtn);

    await screen.findByText(/Step 7: Availability & Calendar/i);
  });

  it('6. Step 5 allows adding and removing amenities which updates readiness score in Step 10', async () => {
    vi.mocked(ownerApi.getVenue).mockResolvedValue({
      id: 'venue-amenities-test',
      owner_id: 'owner-1',
      name: 'Greenfield Turf',
      display_name: 'Greenfield Turf',
      tagline: 'All-weather grass',
      slug: 'greenfield-turf',
      category: 'Sports & Fitness',
      category_id: 'cat-1',
      address: '100 Ring Road',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pincode: '226010',
      capacity: 30,
      unit_type: 'hour',
      base_price: '1200',
      status: 'draft',
      rejection_reason: null,
      suspension_reason: null,
      avg_rating: '0',
      amenities: [],
      content_blocks: [],
      created_at: new Date().toISOString(),
      description: null,
      media: [
        { id: '1', url: 'https://example.com/1.jpg', is_cover: true, sort_order: 0 },
        { id: '2', url: 'https://example.com/2.jpg', is_cover: false, sort_order: 1 },
        { id: '3', url: 'https://example.com/3.jpg', is_cover: false, sort_order: 2 },
      ],
    });

    renderWithProviders(
      <ListingBuilder venueId="venue-amenities-test" onClose={() => {}} onComplete={() => {}} />
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading venue listing/i)).not.toBeInTheDocument();
    });

    // Advance to Step 5: Features & Amenities
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 1 -> 2
    await screen.findByText(/What kind of venue is this/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 2 -> 3
    await screen.findByText(/Configure details for each event type/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 3 -> 4
    await screen.findByText(/Where is your space situated/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 4 -> 5

    await screen.findByText(/Step 5: Features & Amenities/i);
    expect(screen.getByText(/Space specs & facilities/i)).toBeInTheDocument();

    // Select an amenity from popular list (e.g. High-Speed Wi-Fi)
    const wifiBtn = screen.getByRole('button', { name: /High-Speed Wi-Fi/i });
    fireEvent.click(wifiBtn);

    // Add a custom amenity
    const customInput = screen.getByPlaceholderText(/Swimming Pool/i);
    fireEvent.change(customInput, { target: { value: 'Night Floodlights' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    // Selected amenities pill summary should have both
    expect(screen.getByText(/Selected Amenities \(2\)/i)).toBeInTheDocument();

    // Advance to Step 10 (Review & Submit)
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 5 -> 6
    await screen.findByText(/How would you like to rent your space/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 6 -> 7
    await screen.findByText(/Schedule bookable slots/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 7 -> 8
    await screen.findByText(/Showcase your venue/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 8 -> 9
    await screen.findByText(/Build your custom venue description/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // 9 -> 10

    await screen.findByText(/Step 10: Final Review & Submission/i);

    // Readiness score should show Features & Amenities Configured is checked (100%)
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
