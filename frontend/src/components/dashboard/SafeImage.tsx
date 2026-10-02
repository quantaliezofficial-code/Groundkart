import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
  containerClassName?: string;
}

export function SafeImage({ 
  src, 
  alt, 
  className = '', 
  containerClassName = '',
  fallbackText = 'Image unavailable',
  ...props 
}: SafeImageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!src) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    const img = new Image();
    img.src = src;
    img.onload = () => setStatus('success');
    img.onerror = () => setStatus('error');
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-surface-container ${containerClassName}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 shimmer" />
      )}
      
      {status === 'success' && src && (
        <img 
          src={src} 
          alt={alt} 
          className={`h-full w-full object-cover transition-opacity duration-300 ${className}`} 
          {...props} 
        />
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-mist/50 p-4 text-center">
          <ImageIcon className="mb-2 h-8 w-8 text-ink/40" />
          <span className="font-sans text-xs font-medium text-on-surface-variant">{fallbackText}</span>
        </div>
      )}
    </div>
  );
}
