import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { darkTheme, radius, spacing } from '../theme';

interface GlassPanelProps extends ViewProps {
  variant?: 'default' | 'subtle' | 'highlight';
  style?: ViewStyle;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  variant = 'default',
  style,
  children,
  ...props
}) => {
  const panelStyle =
    variant === 'subtle'
      ? darkTheme.glass.panelSubtle
      : variant === 'highlight'
      ? darkTheme.glass.panelHighlight
      : darkTheme.glass.panel;

  return (
    <View style={[styles.base, panelStyle, style]} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: spacing.base,
    overflow: 'hidden',
  },
});
