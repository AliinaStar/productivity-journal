import { useWindowDimensions } from 'react-native';

// Shortest-side threshold (dp) that classifies a device as a tablet. 600dp is
// the conventional Android "large" breakpoint and comfortably excludes phones,
// which stay below it even in landscape.
const TABLET_MIN_SHORT_SIDE = 600;
// Width at which the Today screen has room for a side-by-side master-detail
// layout. Below this — phones and tablets in portrait — we stay single-column.
const TWO_COLUMN_MIN_WIDTH = 840;

export interface Responsive {
  width: number;
  height: number;
  /** A tablet-class device (in any orientation). Drives the nav rail + bounded content. */
  isTablet: boolean;
  isLandscape: boolean;
  /** Enough horizontal room for a master-detail split (tablet in landscape). */
  twoColumn: boolean;
}

// Single source of truth for layout breakpoints. Re-renders on rotation because
// useWindowDimensions updates, so every consumer reflows automatically.
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_SHORT_SIDE;
  return {
    width,
    height,
    isTablet,
    isLandscape: width > height,
    twoColumn: isTablet && width >= TWO_COLUMN_MIN_WIDTH,
  };
}
