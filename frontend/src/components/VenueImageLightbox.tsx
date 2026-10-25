import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize2,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';

export interface VenueImageLightboxProps {
  isOpen: boolean;
  images: string[];
  initialIndex?: number;
  venueName: string;
  onClose: () => void;
}

export default function VenueImageLightbox({
  isOpen,
  images = [],
  initialIndex = 0,
  venueName,
  onClose,
}: VenueImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Sync initial index when modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      const safeIndex = Math.max(0, Math.min(initialIndex, images.length - 1));
      setCurrentIndex(safeIndex);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex, images.length]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Reset zoom & pan when image changes
  const resetZoomAndPan = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Image navigation
  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    resetZoomAndPan();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length, resetZoomAndPan]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    resetZoomAndPan();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length, resetZoomAndPan]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(Number((prev + 0.5).toFixed(1)), 3.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(Number((prev - 0.5).toFixed(1)), 1);
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    resetZoomAndPan();
  }, [resetZoomAndPan]);

  const handleToggleDoubleTapZoom = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((prev) => {
      if (prev > 1) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
        case 'r':
        case 'R':
          e.preventDefault();
          handleResetZoom();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom, toggleFullscreen]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (!thumbnailsRef.current) return;
    const activeThumb = thumbnailsRef.current.children[currentIndex] as HTMLElement | undefined;
    if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else if (e.deltaY > 0) {
      handleZoomOut();
    }
  };

  // Mouse drag handlers for panning when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current || zoom <= 1) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPan({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Touch handlers for mobile swipe & pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (zoom > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          initialPanX: pan.x,
          initialPanY: pan.y,
        };
      } else {
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (zoom > 1 && isDragging && dragStartRef.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.startX;
      const dy = touch.clientY - dragStartRef.current.startY;
      setPan({
        x: dragStartRef.current.initialPanX + dx,
        y: dragStartRef.current.initialPanY + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (zoom > 1) {
      setIsDragging(false);
      dragStartRef.current = null;
      return;
    }

    if (!touchStartRef.current) return;
    const endTouch = e.changedTouches[0];
    const dx = endTouch.clientX - touchStartRef.current.x;
    const dy = endTouch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;

    // Fast horizontal swipe with minimum threshold
    if (elapsed < 400 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartRef.current = null;
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-pitch/95 backdrop-blur-xl select-none"
        role="dialog"
        aria-modal="true"
        aria-label={`Photo gallery for ${venueName}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 z-20 bg-gradient-to-b from-pitch/80 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-chalk/10 text-marigold">
              <ImageIcon size={18} />
            </div>
            <div className="truncate">
              <h2 className="text-chalk font-display text-base sm:text-lg font-bold tracking-tight truncate">
                {venueName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-chalk/70 font-sans">
                <span>
                  Photo {currentIndex + 1} of {images.length}
                </span>
                <span className="w-1 h-1 rounded-full bg-chalk/40" />
                <span className="px-1.5 py-0.5 rounded bg-chalk/10 text-marigold font-mono text-[11px] font-semibold">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Zoom Out */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              aria-label="Zoom out"
              title="Zoom out (-)"
              className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer ${
                zoom <= 1
                  ? 'text-chalk/30 cursor-not-allowed'
                  : 'text-chalk/80 hover:text-chalk hover:bg-chalk/10 active:scale-95'
              }`}
            >
              <ZoomOut size={18} />
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3.5}
              aria-label="Zoom in"
              title="Zoom in (+)"
              className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer ${
                zoom >= 3.5
                  ? 'text-chalk/30 cursor-not-allowed'
                  : 'text-chalk/80 hover:text-chalk hover:bg-chalk/10 active:scale-95'
              }`}
            >
              <ZoomIn size={18} />
            </button>

            {/* Reset Zoom */}
            {zoom > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset zoom"
                title="Reset zoom (0)"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-chalk/10 hover:bg-chalk/20 text-chalk text-xs font-sans transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title="Fullscreen (F)"
              className="p-2 sm:p-2.5 rounded-full text-chalk/80 hover:text-chalk hover:bg-chalk/10 transition-colors cursor-pointer active:scale-95 hidden sm:flex"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize size={18} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close photo gallery"
              title="Close (Esc)"
              className="ml-1 sm:ml-2 p-2 sm:p-2.5 rounded-full bg-chalk/10 hover:bg-clay hover:text-chalk text-chalk transition-all cursor-pointer active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Main Stage Image Area */}
        <div
          className="relative flex-1 flex items-center justify-center overflow-hidden px-4 sm:px-12"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            // Clicking backdrop closes modal if not dragging and at 1x
            if (e.target === e.currentTarget && zoom === 1) {
              onClose();
            }
          }}
        >
          {/* Previous Button */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Previous photo"
              title="Previous photo (Left arrow)"
              className="absolute left-2 sm:left-4 z-30 p-2.5 sm:p-3 rounded-full bg-pitch/70 hover:bg-pitch text-chalk border border-chalk/10 shadow-xl backdrop-blur-md transition-all cursor-pointer hover:scale-110 active:scale-95"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Active Image */}
          <div
            className={`relative max-w-full max-h-[75vh] flex items-center justify-center ${
              zoom > 1
                ? isDragging
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : 'cursor-zoom-in'
            }`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
              transformOrigin: 'center center',
            }}
            onDoubleClick={handleToggleDoubleTapZoom}
          >
            <img
              src={currentImage}
              alt={`${venueName} — photo ${currentIndex + 1}`}
              className="max-h-[70vh] sm:max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl pointer-events-none select-none"
              draggable={false}
            />
          </div>

          {/* Next Button */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next photo"
              title="Next photo (Right arrow)"
              className="absolute right-2 sm:right-4 z-30 p-2.5 sm:p-3 rounded-full bg-pitch/70 hover:bg-pitch text-chalk border border-chalk/10 shadow-xl backdrop-blur-md transition-all cursor-pointer hover:scale-110 active:scale-95"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Interactive Exploration Hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="px-3 py-1 rounded-full bg-pitch/80 backdrop-blur-md border border-chalk/10 text-[11px] font-sans text-chalk/70 shadow-lg flex items-center gap-1.5">
              {zoom > 1 ? (
                <span>Drag to explore • Double-click to reset zoom</span>
              ) : (
                <span>Double-click or scroll to zoom in • Swipe to navigate</span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Thumbnail Strip */}
        <footer className="z-20 pb-4 pt-2 px-4 sm:px-8 bg-gradient-to-t from-pitch/90 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-chalk/60 font-sans">
              Gallery ({images.length} photos)
            </span>
            <button
              type="button"
              onClick={() => setShowThumbnails((prev) => !prev)}
              aria-label={showThumbnails ? 'Hide thumbnail filmstrip' : 'Show thumbnail filmstrip'}
              className="flex items-center gap-1 text-xs text-chalk/60 hover:text-marigold transition-colors cursor-pointer font-sans"
            >
              <Layers size={13} />
              <span>{showThumbnails ? 'Hide thumbnails' : 'Show thumbnails'}</span>
            </button>
          </div>

          {showThumbnails && (
            <div
              ref={thumbnailsRef}
              className="flex gap-2 sm:gap-3 overflow-x-auto py-1 no-scrollbar justify-start sm:justify-center items-center"
            >
              {images.map((imgUrl, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      resetZoomAndPan();
                      setCurrentIndex(idx);
                    }}
                    aria-label={`Jump to photo ${idx + 1}`}
                    className={`relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden transition-all cursor-pointer ${
                      isActive
                        ? 'ring-2 ring-marigold scale-105 shadow-md shadow-marigold/20 opacity-100'
                        : 'opacity-50 hover:opacity-90 hover:scale-100'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                    {isActive && (
                      <div className="absolute inset-0 bg-marigold/10 pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
