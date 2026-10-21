export * from './colors';
export * from './typography';
export * from './spacing';

import { darkTheme, lightTheme, Theme } from './colors';
import { typography } from './typography';
import { spacing, radius } from './spacing';

export const theme = {
  ...darkTheme,
  typography,
  spacing,
  radius,
};

export { darkTheme, lightTheme, typography, spacing, radius };
export type { Theme };
