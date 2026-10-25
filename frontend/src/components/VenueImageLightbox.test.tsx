import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VenueImageLightbox from './VenueImageLightbox';

describe('VenueImageLightbox component', () => {
  const mockImages = [
    'https://example.com/venue-1.jpg',
    'https://example.com/venue-2.jpg',
    'https://example.com/venue-3.jpg',
  ];
  const venueName = 'Skyline Arena';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <VenueImageLightbox
        isOpen={false}
        images={mockImages}
        venueName={venueName}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly when isOpen is true with venue name and photo counter', () => {
    render(
      <VenueImageLightbox
        isOpen={true}
        images={mockImages}
        initialIndex={0}
        venueName={venueName}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(venueName)).toBeInTheDocument();
    expect(screen.getByText('Photo 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    const currentImg = screen.getByAltText(`${venueName} — photo 1`);
    expect(currentImg).toBeInTheDocument();
    expect(currentImg).toHaveAttribute('src', mockImages[0]);
  });

  it('navigates to next and previous photos via navigation buttons', async () => {
    const user = userEvent.setup();
    render(
      <VenueImageLightbox
        isOpen={true}
        images={mockImages}
        initialIndex={0}
        venueName={venueName}
        onClose={vi.fn()}
      />
    );

    const nextBtn = screen.getByRole('button', { name: /next photo/i });
    await user.click(nextBtn);

    expect(screen.getByText('Photo 2 of 3')).toBeInTheDocument();
    expect(screen.getByAltText(`${venueName} — photo 2`)).toHaveAttribute('src', mockImages[1]);

    const prevBtn = screen.getByRole('button', { name: /previous photo/i });
    await user.click(prevBtn);

    expect(screen.getByText('Photo 1 of 3')).toBeInTheDocument();
    expect(screen.getByAltText(`${venueName} — photo 1`)).toHaveAttribute('src', mockImages[0]);
  });

  it('navigates directly when clicking a thumbnail', async () => {
    const user = userEvent.setup();
    render(
      <VenueImageLightbox
        isOpen={true}
        images={mockImages}
        initialIndex={0}
        venueName={venueName}
        onClose={vi.fn()}
      />
    );

    const thumb3 = screen.getByRole('button', { name: /jump to photo 3/i });
    await user.click(thumb3);

    expect(screen.getByText('Photo 3 of 3')).toBeInTheDocument();
    expect(screen.getByAltText(`${venueName} — photo 3`)).toHaveAttribute('src', mockImages[2]);
  });

  it('handles zoom in, zoom out, and reset zoom', async () => {
    const user = userEvent.setup();
    render(
      <VenueImageLightbox
        isOpen={true}
        images={mockImages}
        initialIndex={0}
        venueName={venueName}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset zoom/i })).toBeNull();

    const zoomInBtn = screen.getByRole('button', { name: /zoom in/i });
    await user.click(zoomInBtn);

    expect(screen.getByText('150%')).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: /reset zoom/i });
    expect(resetBtn).toBeInTheDocument();

    await user.click(zoomInBtn);
    expect(screen.getByText('200%')).toBeInTheDocument();

    const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });
    await user.click(zoomOutBtn);
    expect(screen.getByText('150%')).toBeInTheDocument();

    await user.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('toggles zoom on double-clicking image container', async () => {
    render(
      <VenueImageLightbox
        isOpen={true}
        images={mockImages}
        initialIndex={0}
        venueName={venueName}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    const imgWrapper = screen.getByAltText(`${venueName} — photo 1`).parentElement;
    expect(imgWrapper).not.toBeNull();

    fireEvent.doubleClick(imgWrapper!);
    expect(screen.getByText('200%')).toBeInTheDocument();

    fireEvent.doubleClick(imgWrapper!);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('supports keyboard navigation (ArrowRight, ArrowLeft, Escape)', () => {
    const handleClose = vi.fn();
    render(
      <VenueImageLightbox
        isOpen={true}
        images={mockImages}
        initialIndex={0}
        venueName={venueName}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Photo 2 of 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Photo 1 of 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '+' });
    expect(screen.getByText('150%')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '0' });
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    render(
      <VenueImageLightbox
        isOpen={true}
        images={mockImages}
        initialIndex={0}
        venueName={venueName}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /close photo gallery/i });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('toggles thumbnail strip visibility', async () => {
    const user = userEvent.setup();
    render(
      <VenueImageLightbox
        isOpen={true}
        images={mockImages}
        initialIndex={0}
        venueName={venueName}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /jump to photo 1/i })).toBeInTheDocument();

    const hideThumbnailsBtn = screen.getByRole('button', { name: /hide thumbnail filmstrip/i });
    await user.click(hideThumbnailsBtn);

    expect(screen.queryByRole('button', { name: /jump to photo 1/i })).toBeNull();

    const showThumbnailsBtn = screen.getByRole('button', { name: /show thumbnail filmstrip/i });
    await user.click(showThumbnailsBtn);

    expect(screen.getByRole('button', { name: /jump to photo 1/i })).toBeInTheDocument();
  });
});
