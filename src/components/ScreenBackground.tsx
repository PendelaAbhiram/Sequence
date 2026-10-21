import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { darkTheme } from '../theme';

import { FloatingSuitsBackground } from './FloatingSuitsBackground';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  safe?: boolean;
  showSuits?: boolean;
}

export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({
  children,
  style,
  safe = true,
  showSuits = true,
}) => {
  const content = safe ? (
    <SafeAreaView style={[styles.safeArea, style]}>
      {children}
    </SafeAreaView>
  ) : (
    children
  );

  return (
    <LinearGradient
      colors={[...darkTheme.gradient]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.gradient}
    >
      {showSuits && <FloatingSuitsBackground />}
      {content}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
