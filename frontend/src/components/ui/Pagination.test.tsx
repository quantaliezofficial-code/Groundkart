import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination Component', () => {
  it('renders null when totalItems is 0', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        totalItems={0}
        pageSize={12}
        onPageChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders correct summary text for page 1', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        totalItems={30}
        pageSize={12}
        onPageChange={vi.fn()}
      />
    );
    const summary = screen.getByTestId('pagination-summary');
    expect(summary).toHaveTextContent('Showing 1 to 12 of 30 spaces');
  });

  it('renders correct summary text for page 3 (last page with partial items)', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={3}
        totalItems={30}
        pageSize={12}
        onPageChange={vi.fn()}
      />
    );
    const summary = screen.getByTestId('pagination-summary');
    expect(summary).toHaveTextContent('Showing 25 to 30 of 30 spaces');
  });

  it('disables Previous button on first page and Next button on last page', () => {
    const { rerender } = render(
      <Pagination
        currentPage={1}
        totalPages={3}
        totalItems={30}
        pageSize={12}
        onPageChange={vi.fn()}
      />
    );

    const prevBtn = screen.getByLabelText('Previous page');
    const nextBtn = screen.getByLabelText('Next page');

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    rerender(
      <Pagination
        currentPage={3}
        totalPages={3}
        totalItems={30}
        pageSize={12}
        onPageChange={vi.fn()}
      />
    );

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('triggers onPageChange with next/previous and page numbers', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Page 3'));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('triggers onPageSizeChange when a size option is clicked', () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        pageSize={12}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[12, 24, 48]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '24' }));
    expect(onPageSizeChange).toHaveBeenCalledWith(24);
  });

  it('renders ellipses for large number of pages', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={10}
        totalItems={100}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThan(0);
  });
});
