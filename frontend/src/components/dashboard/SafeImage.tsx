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
  containerClassName = 'w-full h-full',
  fallbackText = 'Image unavailable',
  ...props 
}: SafeImageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(src ? 'loading' : 'error');

  useEffect(() => {
    if (!src) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    const img = new Image();
    if (props.referrerPolicy) {
      img.referrerPolicy = props.referrerPolicy;
    }
    img.onload = () => setStatus('success');
    img.onerror = () => setStatus('error');
    img.src = src;

    if (img.complete && img.naturalWidth > 0) {
      setStatus('success');
    }
  }, [src, props.referrerPolicy]);

  return (
    <div className={`relative overflow-hidden bg-surface-container ${containerClassName}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 shimmer pointer-events-none" />
      )}
      
      {src && (
        <img 
          src={src} 
          alt={alt} 
          className={`h-full w-full object-cover transition-opacity duration-300 ${status === 'loading' ? 'opacity-0' : status === 'error' ? 'hidden' : 'opacity-100'} ${className}`} 
          onLoad={() => setStatus('success')}
          onError={() => setStatus('error')}
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
