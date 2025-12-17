import { useState, useEffect, useMemo } from 'react';

interface BottomRowHeight {
  mobile: number;
  desktop: number;
}

interface UseResponsiveCardSizeOptions {
  bottomRowHeight?: BottomRowHeight;
}

interface UseResponsiveCardSizeResult {
  cardSize: number;
  isMobile: boolean;
  dimensions: { width: number; height: number };
}

const DEFAULT_BOTTOM_ROW_HEIGHT: BottomRowHeight = { mobile: 48, desktop: 72 };

export function useResponsiveCardSize(
  options: UseResponsiveCardSizeOptions = {}
): UseResponsiveCardSizeResult {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { cardSize, isMobile } = useMemo(() => {
    const { width, height } = dimensions;
    const isMobile = width < 768;
    const isPortrait = height > width;

    const bottomRowHeight = options.bottomRowHeight ?? DEFAULT_BOTTOM_ROW_HEIGHT;

    // Tighter spacing on mobile
    const topBarHeight = isMobile ? 40 : 48;
    const bottomHeight = isMobile ? bottomRowHeight.mobile : bottomRowHeight.desktop;
    const padding = isMobile ? 4 : 32;
    const cardGap = isMobile ? 16 : 32;

    const availableHeight = height - topBarHeight - bottomHeight - padding * 2;
    const availableWidth = width - padding * 2;

    let size: number;

    if (isMobile && isPortrait) {
      // Portrait mobile: cards stack vertically, can use full width
      const maxHeightPerCard = (availableHeight - cardGap) / 2;
      const maxWidth = availableWidth * 0.85;
      size = Math.min(maxHeightPerCard, maxWidth, 380);
    } else if (isMobile) {
      // Landscape mobile: cards side by side
      const heightConstraint = availableHeight * 0.75;
      const widthConstraint = ((availableWidth - cardGap) / 2) * 0.9;
      size = Math.min(heightConstraint, widthConstraint, 380);
    } else {
      // Desktop/tablet: cards side by side with more padding
      const heightConstraint = availableHeight * 0.6;
      const widthConstraint = availableWidth * 0.35;
      size = Math.min(heightConstraint, widthConstraint, 380);
    }

    return { cardSize: Math.max(140, size), isMobile };
  }, [dimensions, options.bottomRowHeight]);

  return { cardSize, isMobile, dimensions };
}
