export const theme = {
  colors: {
    // Primary colors - Black and Blue theme inspired by "Hunted" TV show
    primary: '#0066CC',
    primaryDark: '#004499',
    primaryLight: '#3388DD',
    
    secondary: '#FF6B35',
    secondaryDark: '#E55A2B',
    secondaryLight: '#FF8A5B',
    
    // Grayscale
    background: '#0A0A0A',
    surface: '#1A1A1A',
    surfaceLight: '#2A2A2A',
    
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textMuted: '#888888',
    
    // Status colors
    success: '#00CC66',
    warning: '#FFAA00',
    error: '#FF3366',
    info: '#00AAFF',
    
    // Game-specific colors
    fugitive: '#FF6B35',
    hunter: '#0066CC',
    gamemaster: '#9966CC',
    
    // UI elements
    border: '#333333',
    borderLight: '#444444',
    shadow: 'rgba(0, 0, 0, 0.5)',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
  
  fonts: {
    primary: '"Roboto Condensed", "Arial Narrow", "Helvetica Condensed", sans-serif',
    secondary: '"Arial", "Helvetica", sans-serif',
    mono: '"Courier New", monospace',
  },
  
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  
  fontWeights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
    '4xl': '6rem',
    '5xl': '8rem',
  },
  
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
  
  transitions: {
    fast: '150ms ease-in-out',
    normal: '300ms ease-in-out',
    slow: '500ms ease-in-out',
  },
  
  // Game-specific theme elements
  game: {
    timer: {
      normal: '#FFFFFF',
      warning: '#FFAA00',
      critical: '#FF3366',
    },
    map: {
      player: '#0066CC',
      fugitive: '#FF6B35',
      hunter: '#0066CC',
      extraction: '#00CC66',
      task: '#9966CC',
    },
  },
};

export type Theme = typeof theme;

// Styled-components theme type
declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}
