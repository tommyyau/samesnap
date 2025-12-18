import { useEffect, useState } from 'react';
import type { SymbolItem } from '@/shared/types';

interface UseImagePreloaderResult {
  loaded: boolean;
  progress: number; // 0-100
}

/**
 * Preloads all PNG images from a symbol set before game starts.
 * For emoji sets (no imageUrl), returns immediately as loaded.
 */
export function useImagePreloader(symbols: SymbolItem[]): UseImagePreloaderResult {
  // Check if there are any images to preload
  const hasImages = symbols.some((s) => s.imageUrl);

  // Start as loaded if no images to preload (emoji sets)
  const [loaded, setLoaded] = useState(!hasImages);
  const [progress, setProgress] = useState(hasImages ? 0 : 100);

  useEffect(() => {
    const imageUrls = symbols
      .filter((s) => s.imageUrl)
      .map((s) => s.imageUrl!);

    // No images to preload (emoji set) - mark as loaded immediately
    if (imageUrls.length === 0) {
      setLoaded(true);
      setProgress(100);
      return;
    }

    // Reset state for PNG symbol set
    setLoaded(false);
    setProgress(0);

    let loadedCount = 0;

    const promises = imageUrls.map((url) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          setProgress(Math.round((loadedCount / imageUrls.length) * 100));
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to preload image: ${url}`);
          loadedCount++;
          setProgress(Math.round((loadedCount / imageUrls.length) * 100));
          resolve(); // Resolve anyway to not block game
        };
        img.src = url;
      });
    });

    Promise.all(promises).then(() => {
      setLoaded(true);
    });
  }, [symbols]);

  return { loaded, progress };
}
