import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { palette, radius, spacing, typography } from '../theme';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'gold' | 'blue' | 'red' | 'green' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  variant = 'gold',
  style,
  textStyle,
  onPress,
  ...props
}) => {
  const handlePress = (e: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore if not supported on platform
    }
    onPress?.(e);
  };

  const buttonBackground =
    variant === 'gold'
      ? styles.goldButton
      : variant === 'blue'
      ? styles.blueButton
      : variant === 'red'
      ? styles.redButton
      : variant === 'green'
      ? styles.greenButton
      : styles.outlineButton;

  const textColor =
    variant === 'gold'
      ? styles.darkText
      : variant === 'outline'
      ? styles.outlineText
      : styles.whiteText;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.button, buttonBackground, style]}
      onPress={handlePress}
      {...props}
    >
      <Text style={[styles.text, textColor, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  goldButton: {
    backgroundColor: palette.gold,
  },
  blueButton: {
    backgroundColor: palette.blue,
  },
  redButton: {
    backgroundColor: palette.red,
  },
  greenButton: {
    backgroundColor: palette.green,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  text: {
    ...typography.button,
    textTransform: 'uppercase',
  },
  darkText: {
    color: '#0F172A',
  },
  whiteText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#F8FAFC',
  },
});
