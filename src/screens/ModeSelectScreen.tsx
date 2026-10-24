import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenBackground, GlassPanel, PrimaryButton, ScreenHeader } from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { ScreenProps } from './types';

export const ModeSelectScreen: React.FC<ScreenProps<'ModeSelect'>> = ({ navigation }) => {
  const [teamCount, setTeamCount] = useState<2 | 3>(2);

  return (
    <ScreenBackground>
      <View style={styles.container}>
        <ScreenHeader
          title="SELECT MODE"
          subtitle="Choose your match configuration"
          onBack={() => navigation.navigate('Home')}
        />

        <View style={styles.content}>
          <Text style={styles.sectionHeader}>TEAM FORMAT</Text>
          
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setTeamCount(2)}
            style={[
              styles.optionCard,
              teamCount === 2 && styles.selectedOption,
            ]}
          >
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>2 Teams (Red vs Blue)</Text>
              <Text style={styles.goalBadge}>Goal: 2 Sequences</Text>
            </View>
            <Text style={styles.optionDescription}>
              Standard match format. Best for 2, 4, 6, 8, 10, or 12 players.
            </Text>
            <View style={styles.teamChips}>
              <View style={[styles.chip, { backgroundColor: palette.red }]} />
              <View style={[styles.chip, { backgroundColor: palette.blue }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setTeamCount(3)}
            style={[
              styles.optionCard,
              teamCount === 3 && styles.selectedOption,
            ]}
          >
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>3 Teams (Red vs Blue vs Green)</Text>
              <Text style={styles.goalBadge}>Goal: 1 Sequence</Text>
            </View>
            <Text style={styles.optionDescription}>
              3-way clash! Allowed for 3, 6, 9, or 12 players.
            </Text>
            <View style={styles.teamChips}>
              <View style={[styles.chip, { backgroundColor: palette.red }]} />
              <View style={[styles.chip, { backgroundColor: palette.blue }]} />
              <View style={[styles.chip, { backgroundColor: palette.green }]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            title="Continue to Player Setup"
            variant="gold"
            onPress={() => navigation.navigate('PlayerSetup')}
          />
          <PrimaryButton
            title="Back"
            variant="outline"
            onPress={() => navigation.goBack()}
          />
        </View>
      </View>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  title: {
    ...typography.h2,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.caption,
    color: palette.gold,
    marginTop: spacing.xs,
  },
  content: {
    gap: spacing.md,
  },
  sectionHeader: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  optionCard: {
    backgroundColor: 'rgba(16, 28, 48, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.md,
    padding: spacing.base,
    gap: spacing.xs,
  },
  selectedOption: {
    borderColor: palette.gold,
    backgroundColor: 'rgba(245, 200, 76, 0.12)',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTitle: {
    ...typography.subtitle,
    color: '#FFFFFF',
  },
  goalBadge: {
    ...typography.caption,
    color: palette.gold,
    fontWeight: '700',
  },
  optionDescription: {
    ...typography.caption,
    color: '#94A3B8',
  },
  teamChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  footer: {
    gap: spacing.sm,
  },
});
