import { useWindowDimensions } from 'react-native';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ResponsiveLayout {
  screenWidth: number;
  screenHeight: number;
  availableWidth: number;
  availableHeight: number;
  insets: EdgeInsets;
  cellSize: number;
  boardSize: number;
  isLandscape: boolean;
  isTablet: boolean;
}

export function computeResponsiveLayout(
  width: number,
  height: number,
  insets: EdgeInsets
): ResponsiveLayout {
  const isLandscape = width > height;
  const availableWidth = width - (insets.left + insets.right);
  const availableHeight = height - (insets.top + insets.bottom);
  
  // Board cell size = min(screenWidth, availableHeight) / 10 as specified in rules
  const cellSize = Math.floor(Math.min(width, availableHeight) / 10);
  const boardSize = cellSize * 10;
  const isTablet = Math.min(width, height) >= 600;

  return {
    screenWidth: width,
    screenHeight: height,
    availableWidth,
    availableHeight,
    insets,
    cellSize,
    boardSize,
    isLandscape,
    isTablet,
  };
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return computeResponsiveLayout(width, height, insets);
}
