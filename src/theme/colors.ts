// Sequence Game Theme Colors

export const palette = {
  // Brand / Team Colors
  red: '#E5484D',
  blue: '#3E63DD',
  green: '#30A46C',
  gold: '#F5C84C',

  // Accent / Status
  redHover: '#DC3D43',
  blueHover: '#3358D4',
  greenHover: '#299764',
  goldHover: '#EBB938',

  // Gradient definitions: Deep felt-green to midnight-navy
  feltGreen: '#0D382B',
  feltDark: '#0A2920',
  midnightNavy: '#0A1526',
  midnightDeep: '#060B14',

  feltGradient: ['#0E3E30', '#0B292E', '#081422'] as const,
  feltGradientLight: ['#145240', '#103940', '#0C2036'] as const,
  cardGradient: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)'] as const,

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
};

export const darkTheme = {
  mode: 'dark' as const,
  colors: {
    ...palette,
    background: palette.midnightDeep,
    surface: '#111C2D',
    surfaceSubtle: 'rgba(255, 255, 255, 0.05)',
    card: '#162238',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: 'rgba(255, 255, 255, 0.12)',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    activeIndicator: palette.gold,
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  gradient: palette.feltGradient,
  glass: {
    panel: {
      backgroundColor: 'rgba(16, 28, 48, 0.72)',
      borderColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
    panelSubtle: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
    },
    panelHighlight: {
      backgroundColor: 'rgba(245, 200, 76, 0.12)',
      borderColor: 'rgba(245, 200, 76, 0.35)',
      borderWidth: 1.5,
    },
  },
};

export const lightTheme = {
  mode: 'light' as const,
  colors: {
    ...palette,
    background: '#F0F4F8',
    surface: '#FFFFFF',
    surfaceSubtle: 'rgba(0, 0, 0, 0.03)',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: 'rgba(0, 0, 0, 0.1)',
    borderSubtle: 'rgba(0, 0, 0, 0.05)',
    activeIndicator: palette.blue,
    overlay: 'rgba(0, 0, 0, 0.45)',
  },
  gradient: ['#0F4434', '#13354B', '#11253C'] as const,
  glass: {
    panel: {
      backgroundColor: 'rgba(255, 255, 255, 0.88)',
      borderColor: 'rgba(255, 255, 255, 0.6)',
      borderWidth: 1,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    panelSubtle: {
      backgroundColor: 'rgba(255, 255, 255, 0.65)',
      borderColor: 'rgba(0, 0, 0, 0.06)',
      borderWidth: 1,
    },
    panelHighlight: {
      backgroundColor: 'rgba(62, 99, 221, 0.08)',
      borderColor: 'rgba(62, 99, 221, 0.3)',
      borderWidth: 1.5,
    },
  },
};

export type Theme = typeof darkTheme;
