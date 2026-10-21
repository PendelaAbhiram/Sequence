// ─────────────────────────────────────────────────────────────────────────────
// Subtle Floating Suits Background Component
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, Dimensions } from 'react-native';

interface FloatingItem {
  suit: string;
  color: string;
  size: number;
  startX: number;
  startY: number;
  duration: number;
  delay: number;
}

const SUIT_ITEMS: FloatingItem[] = [
  { suit: '♠', color: 'rgba(255, 255, 255, 0.08)', size: 38, startX: 0.12, startY: 0.15, duration: 8000, delay: 0 },
  { suit: '♥', color: 'rgba(229, 72, 77, 0.12)', size: 44, startX: 0.82, startY: 0.22, duration: 9500, delay: 1000 },
  { suit: '♦', color: 'rgba(245, 200, 76, 0.1)', size: 36, startX: 0.2, startY: 0.72, duration: 9000, delay: 500 },
  { suit: '♣', color: 'rgba(62, 99, 221, 0.12)', size: 42, startX: 0.75, startY: 0.65, duration: 8500, delay: 1500 },
  { suit: '♠', color: 'rgba(255, 255, 255, 0.06)', size: 50, startX: 0.48, startY: 0.42, duration: 11000, delay: 2000 },
  { suit: '♥', color: 'rgba(229, 72, 77, 0.08)', size: 32, startX: 0.08, startY: 0.48, duration: 7500, delay: 800 },
  { suit: '♦', color: 'rgba(245, 200, 76, 0.08)', size: 46, startX: 0.88, startY: 0.85, duration: 10000, delay: 1200 },
];

export const FloatingSuitsBackground: React.FC = () => {
  const animValues = useRef(SUIT_ITEMS.map(() => new Animated.Value(0))).current;
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    const anims = animValues.map((anim, idx) => {
      const item = SUIT_ITEMS[idx];
      return Animated.loop(
        Animated.sequence([
          Animated.delay(item.delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: item.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: item.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
    });

    anims.forEach((a) => a.start());

    return () => {
      anims.forEach((a) => a.stop());
    };
  }, [animValues]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SUIT_ITEMS.map((item, idx) => {
        const translateY = animValues[idx].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -25],
        });
        const rotate = animValues[idx].interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', idx % 2 === 0 ? '12deg' : '-12deg'],
        });
        const opacity = animValues[idx].interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.6, 1, 0.6],
        });

        return (
          <Animated.Text
            key={idx}
            style={[
              styles.suitText,
              {
                color: item.color,
                fontSize: item.size,
                left: item.startX * width,
                top: item.startY * height,
                transform: [{ translateY }, { rotate }],
                opacity,
              },
            ]}
          >
            {item.suit}
          </Animated.Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  suitText: {
    position: 'absolute',
    fontWeight: '900',
    userSelect: 'none',
  },
});
