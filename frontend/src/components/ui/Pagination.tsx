import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [12, 24, 48],
  className = '',
}) => {
  if (totalItems === 0 || totalPages <= 1 && (!onPageSizeChange || totalItems <= pageSizeOptions[0])) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('ellipsis');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push('ellipsis');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('ellipsis');
      pages.push(currentPage - 1);
      pages.push(currentPage);
      pages.push(currentPage + 1);
      pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav
      aria-label="Venue pagination"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-ink/10 ${className}`}
    >
      {/* Items Summary */}
      <div
        data-testid="pagination-summary"
        className="font-sans text-xs text-on-surface-variant text-center sm:text-left"
      >
        Showing <span className="font-bold text-ink">{startItem}</span> to{' '}
        <span className="font-bold text-ink">{endItem}</span> of{' '}
        <span className="font-bold text-pitch">{totalItems}</span> spaces
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Page Size Selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 font-sans text-xs text-on-surface-variant mr-2">
            <span>Per page:</span>
            <div className="flex items-center gap-1 bg-mist p-0.5 rounded-lg border border-ink/5">
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onPageSizeChange(size)}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    pageSize === size
                      ? 'bg-chalk text-pitch shadow-xs font-bold'
                      : 'text-on-surface-variant hover:text-ink'
                  }`}
                  aria-pressed={pageSize === size}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Page Navigation Controls */}
        <div className="flex items-center gap-1">
          {/* Previous Button */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-ink/10 bg-chalk text-ink hover:bg-mist disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page Number Buttons */}
          {pages.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 h-8 flex items-center justify-center font-sans text-xs text-on-surface-variant"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`w-8 h-8 rounded-lg font-sans text-xs font-semibold transition cursor-pointer ${
                  isCurrent
                    ? 'bg-pitch text-chalk font-bold shadow-xs'
                    : 'border border-ink/10 bg-chalk text-ink hover:bg-mist'
                }`}
              >
                {p}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-ink/10 bg-chalk text-ink hover:bg-mist disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
};
