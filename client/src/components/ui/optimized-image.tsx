import React, { useState, useEffect, useRef, memo } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  placeholderSrc?: string;
  lazy?: boolean;
  fadeIn?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  aspectRatio?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  sizes?: string;
  srcSet?: string;
  priority?: boolean;
}

const OptimizedImageComponent: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fallbackSrc = '/placeholder.svg',
  placeholderSrc,
  lazy = true,
  fadeIn = true,
  onLoad,
  onError,
  className,
  aspectRatio,
  objectFit = 'cover',
  sizes,
  srcSet,
  priority = false,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState(placeholderSrc || '');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!lazy || priority) {
      // Load immediately if not lazy or has priority
      loadImage();
    } else {
      // Set up intersection observer for lazy loading
      if ('IntersectionObserver' in window) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                loadImage();
                if (observerRef.current && imgRef.current) {
                  observerRef.current.unobserve(imgRef.current);
                }
              }
            });
          },
          {
            rootMargin: '50px', // Start loading 50px before entering viewport
            threshold: 0.01,
          }
        );

        if (imgRef.current) {
          observerRef.current.observe(imgRef.current);
        }
      } else {
        // Fallback for browsers without IntersectionObserver
        loadImage();
      }
    }

    return () => {
      if (observerRef.current && imgRef.current) {
        observerRef.current.unobserve(imgRef.current);
      }
    };
  }, [src, lazy, priority]);

  const loadImage = () => {
    const img = new Image();
    
    if (srcSet) {
      img.srcset = srcSet;
    }
    
    if (sizes) {
      img.sizes = sizes;
    }

    img.onload = () => {
      setImageSrc(src);
      setImageLoaded(true);
      setImageError(false);
      onLoad?.();
    };

    img.onerror = () => {
      setImageSrc(fallbackSrc);
      setImageError(true);
      setImageLoaded(true);
      onError?.();
    };

    img.src = src;
  };

  const handleNativeError = () => {
    if (!imageError && fallbackSrc) {
      setImageSrc(fallbackSrc);
      setImageError(true);
    }
  };

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {placeholderSrc && !imageLoaded && (
        <img
          src={placeholderSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm"
          aria-hidden="true"
        />
      )}
      
      <img
        ref={imgRef}
        src={imageSrc || placeholderSrc || fallbackSrc}
        alt={alt}
        onError={handleNativeError}
        className={cn(
          'w-full h-full',
          fadeIn && 'transition-opacity duration-300',
          imageLoaded ? 'opacity-100' : 'opacity-0',
          objectFit && `object-${objectFit}`
        )}
        loading={lazy && !priority ? 'lazy' : 'eager'}
        decoding={priority ? 'sync' : 'async'}
        sizes={sizes}
        srcSet={srcSet}
        {...props}
      />
      
      {!imageLoaded && !placeholderSrc && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse" />
      )}
    </div>
  );
};

// Memoized version for better performance
export const OptimizedImage = memo(OptimizedImageComponent);

// Picture component for responsive images with multiple sources
interface PictureSource {
  srcSet: string;
  media?: string;
  type?: string;
  sizes?: string;
}

interface OptimizedPictureProps extends OptimizedImageProps {
  sources?: PictureSource[];
}

const OptimizedPictureComponent: React.FC<OptimizedPictureProps> = ({
  sources = [],
  ...imageProps
}) => {
  return (
    <picture>
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet}
          media={source.media}
          type={source.type}
          sizes={source.sizes}
        />
      ))}
      <OptimizedImage {...imageProps} />
    </picture>
  );
};

export const OptimizedPicture = memo(OptimizedPictureComponent);

// Hook for preloading images
export function useImagePreloader(urls: string[]) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadImage = (url: string) => {
      const img = new Image();
      
      img.onload = () => {
        setLoaded((prev) => ({ ...prev, [url]: true }));
      };
      
      img.onerror = () => {
        setErrors((prev) => ({ ...prev, [url]: true }));
      };
      
      img.src = url;
    };

    urls.forEach(loadImage);
  }, [urls]);

  return { loaded, errors };
}

// Utility function to generate responsive image URLs
export function generateImageSrcSet(
  baseUrl: string,
  sizes: number[] = [320, 640, 768, 1024, 1280, 1536]
): string {
  return sizes
    .map((size) => {
      const url = baseUrl.replace('{width}', size.toString());
      return `${url} ${size}w`;
    })
    .join(', ');
}

// Utility function to generate image sizes attribute
export function generateImageSizes(
  breakpoints: { maxWidth?: number; minWidth?: number; size: string }[]
): string {
  return breakpoints
    .map((bp) => {
      if (bp.maxWidth) {
        return `(max-width: ${bp.maxWidth}px) ${bp.size}`;
      } else if (bp.minWidth) {
        return `(min-width: ${bp.minWidth}px) ${bp.size}`;
      }
      return bp.size;
    })
    .join(', ');
}

export default OptimizedImage;
