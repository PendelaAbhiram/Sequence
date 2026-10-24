import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { palette, spacing, typography } from '../theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = '‹ Back',
  showBack = true,
  rightAction,
}) => {
  const navigation = useNavigation<any>();

  const handleBackPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.sideSlot}>
          {showBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Text style={styles.backButtonText}>{backLabel}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sideSlotRight}>
          {rightAction}
        </View>
      </View>

      <View style={styles.titleWrapper}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  sideSlot: {
    minWidth: 60,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideSlotRight: {
    minWidth: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    ...typography.subtitle,
    color: palette.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  titleWrapper: {
    alignItems: 'center',
    marginTop: -4,
  },
  title: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
});
