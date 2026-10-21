// ─────────────────────────────────────────────────────────────────────────────
// Sequence – Settings & Local Statistics Screen
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ScreenBackground, GlassPanel, PrimaryButton } from '../components';
import { palette, radius, spacing, typography } from '../theme';
import { ScreenProps } from './types';
import { useSettingsStore, AppTheme, CardSizePreference, AppLanguage } from '../store/settingsStore';

export const SettingsScreen: React.FC<ScreenProps<'Settings'>> = ({ navigation }) => {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const theme = useSettingsStore((s) => s.theme);
  const cardSize = useSettingsStore((s) => s.cardSize);
  const colorBlindMode = useSettingsStore((s) => s.colorBlindMode);
  const language = useSettingsStore((s) => s.language);
  const stats = useSettingsStore((s) => s.stats);

  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setCardSize = useSettingsStore((s) => s.setCardSize);
  const setColorBlindMode = useSettingsStore((s) => s.setColorBlindMode);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const resetStats = useSettingsStore((s) => s.resetStats);

  const botWinRate =
    stats.botGamesPlayed > 0
      ? Math.round((stats.botWins / stats.botGamesPlayed) * 100)
      : 0;

  const handleResetStats = () => {
    Alert.alert(
      'Reset Statistics',
      'Are you sure you want to reset all games played and win records? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {}
            resetStats();
          },
        },
      ]
    );
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>SETTINGS</Text>
          <Text style={styles.subtitle}>Preferences, Accessibility & Career Stats</Text>
        </View>

        {/* 1. AUDIO & HAPTICS */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionHeader}>AUDIO & FEEDBACK</Text>
          <GlassPanel style={styles.panel}>
            <View style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <Text style={styles.rowTitle}>Sound Effects</Text>
                <Text style={styles.rowDesc}>Chip placement clicks, shuffles, jingles</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ false: '#334155', true: palette.green }}
                thumbColor={palette.white}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <Text style={styles.rowTitle}>Background Music</Text>
                <Text style={styles.rowDesc}>Lo-fi ambient jazz chord progression loop</Text>
              </View>
              <Switch
                value={musicEnabled}
                onValueChange={setMusicEnabled}
                trackColor={{ false: '#334155', true: palette.green }}
                thumbColor={palette.white}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <Text style={styles.rowTitle}>Haptic Feedback</Text>
                <Text style={styles.rowDesc}>Vibrations on move selection and sequence score</Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={setHapticsEnabled}
                trackColor={{ false: '#334155', true: palette.green }}
                thumbColor={palette.white}
              />
            </View>
          </GlassPanel>
        </View>

        {/* 2. ACCESSIBILITY & VISUALS */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionHeader}>ACCESSIBILITY & DISPLAY</Text>
          <GlassPanel style={styles.panel}>
            {/* Colour-blind Mode */}
            <View style={styles.row}>
              <View style={styles.rowLabelContainer}>
                <Text style={styles.rowTitle}>Colour-Blind Mode</Text>
                <Text style={styles.rowDesc}>Shape icons on chips (Red ●, Blue ■, Green ▲)</Text>
              </View>
              <Switch
                value={colorBlindMode}
                onValueChange={setColorBlindMode}
                trackColor={{ false: '#334155', true: palette.green }}
                thumbColor={palette.white}
              />
            </View>

            {/* Theme Toggle */}
            <View style={styles.selectorRow}>
              <Text style={styles.rowTitle}>Theme</Text>
              <View style={styles.segmentedSelector}>
                {(['dark', 'light'] as AppTheme[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.8}
                    onPress={() => setTheme(t)}
                    style={[
                      styles.segmentedPill,
                      theme === t && styles.segmentedPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedPillText,
                        theme === t && styles.segmentedPillTextActive,
                      ]}
                    >
                      {t === 'dark' ? 'Midnight Felt' : 'Clubroom Light'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Card Size */}
            <View style={styles.selectorRow}>
              <Text style={styles.rowTitle}>Hand Card Scale</Text>
              <View style={styles.segmentedSelector}>
                {(['compact', 'normal', 'large'] as CardSizePreference[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    activeOpacity={0.8}
                    onPress={() => setCardSize(s)}
                    style={[
                      styles.segmentedPill,
                      cardSize === s && styles.segmentedPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedPillText,
                        cardSize === s && styles.segmentedPillTextActive,
                      ]}
                    >
                      {s.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Language */}
            <View style={styles.selectorRow}>
              <Text style={styles.rowTitle}>Language</Text>
              <View style={styles.segmentedSelector}>
                {(['en', 'es', 'fr', 'de'] as AppLanguage[]).map((l) => (
                  <TouchableOpacity
                    key={l}
                    activeOpacity={0.8}
                    onPress={() => setLanguage(l)}
                    style={[
                      styles.segmentedPill,
                      language === l && styles.segmentedPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedPillText,
                        language === l && styles.segmentedPillTextActive,
                      ]}
                    >
                      {l.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </GlassPanel>
        </View>

        {/* 3. LOCAL PLAYER CAREER STATS */}
        <View style={styles.sectionWrapper}>
          <View style={styles.statsHeaderRow}>
            <Text style={styles.sectionHeader}>CAREER STATISTICS (LOCAL)</Text>
            {stats.gamesPlayed > 0 && (
              <TouchableOpacity onPress={handleResetStats}>
                <Text style={styles.resetStatsLink}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          <GlassPanel style={styles.panel}>
            <View style={styles.statGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{stats.gamesPlayed}</Text>
                <Text style={styles.statBoxLabel}>Total Matches</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={[styles.statBoxValue, { color: palette.gold }]}>
                  {stats.wins}
                </Text>
                <Text style={styles.statBoxLabel}>Victories</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={[styles.statBoxValue, { color: '#38BDF8' }]}>
                  {botWinRate}%
                </Text>
                <Text style={styles.statBoxLabel}>Win Rate vs AI</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statBoxValue}>{stats.sequencesFormed}</Text>
                <Text style={styles.statBoxLabel}>Sequences Formed</Text>
              </View>
            </View>

            <View style={styles.statListRow}>
              <Text style={styles.statListLabel}>Matches vs Computer (Bot)</Text>
              <Text style={styles.statListValue}>
                {stats.botWins} / {stats.botGamesPlayed} won
              </Text>
            </View>

            <View style={styles.statListRow}>
              <Text style={styles.statListLabel}>Matches with Friends (Pass & Play)</Text>
              <Text style={styles.statListValue}>{stats.localGamesPlayed} played</Text>
            </View>

            <View style={styles.statListRow}>
              <Text style={styles.statListLabel}>Total Chips Placed</Text>
              <Text style={styles.statListValue}>{stats.chipsPlaced}</Text>
            </View>

            <View style={styles.statListRow}>
              <Text style={styles.statListLabel}>Special Jacks Played</Text>
              <Text style={styles.statListValue}>{stats.jacksUsed}</Text>
            </View>
          </GlassPanel>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <PrimaryButton
            title="Save & Return"
            variant="gold"
            onPress={() => navigation.goBack()}
          />
        </View>
      </ScrollView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  header: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    ...typography.h2,
    color: '#FFFFFF',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: palette.gold,
    textAlign: 'center',
  },
  sectionWrapper: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.xs,
  },
  sectionHeader: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1.5,
    paddingLeft: 4,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 4,
  },
  resetStatsLink: {
    ...typography.caption,
    color: '#EF4444',
    fontWeight: '800',
  },
  panel: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xxs,
  },
  rowLabelContainer: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  rowTitle: {
    ...typography.subtitle,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  rowDesc: {
    ...typography.caption,
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  selectorRow: {
    paddingVertical: spacing.xxs,
    gap: 6,
  },
  segmentedSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  segmentedPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  segmentedPillActive: {
    backgroundColor: palette.gold,
  },
  segmentedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  segmentedPillTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statBoxValue: {
    ...typography.h2,
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statBoxLabel: {
    ...typography.caption,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '700',
  },
  statListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  statListLabel: {
    ...typography.caption,
    fontSize: 12,
    color: '#CBD5E1',
  },
  statListValue: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  footer: {
    width: '100%',
    maxWidth: 420,
    marginTop: spacing.xs,
  },
});
