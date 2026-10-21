// ─────────────────────────────────────────────────────────────────────────────
// DiscardPileBottomSheet – View Each Player's Personal Discard Pile
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { PlayerState } from '../engine/gameReducer';
import { Suit } from '../engine/types';
import { palette, radius, spacing, typography } from '../theme';

interface DiscardPileBottomSheetProps {
  visible: boolean;
  players: PlayerState[];
  onClose: () => void;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: '#1E293B',
  clubs: '#334155',
  hearts: '#E5484D',
  diamonds: '#EA580C',
};

export const DiscardPileBottomSheet: React.FC<DiscardPileBottomSheetProps> = ({
  visible,
  players,
  onClose,
}) => {
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0);

  if (!players || players.length === 0) return null;

  const activePlayer = players[selectedPlayerIndex] ?? players[0];
  const discards = activePlayer?.discardPile ?? [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdropTouchable}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>DISCARD PILES</Text>
              <Text style={styles.sheetSubtitle}>Review played & discarded cards</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Player Tab Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {players.map((p, idx) => {
              const isSelected = idx === selectedPlayerIndex;
              const teamColor =
                p.teamId === 'red'
                  ? palette.red
                  : p.teamId === 'blue'
                  ? palette.blue
                  : palette.green;

              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.8}
                  style={[
                    styles.tabItem,
                    isSelected && styles.tabItemActive,
                  ]}
                  onPress={() => setSelectedPlayerIndex(idx)}
                >
                  <View style={[styles.tabChip, { backgroundColor: teamColor }]} />
                  <Text
                    style={[
                      styles.tabText,
                      isSelected && styles.tabTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{p.discardPile.length}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Discarded Cards Grid */}
          <ScrollView
            contentContainerStyle={styles.cardsScroll}
            showsVerticalScrollIndicator={false}
          >
            {discards.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🂠</Text>
                <Text style={styles.emptyText}>No cards discarded yet</Text>
                <Text style={styles.emptySubtext}>
                  Played and dead cards will appear here as the match progresses.
                </Text>
              </View>
            ) : (
              <View style={styles.cardsGrid}>
                {discards.map((card, i) => {
                  const symbol = SUIT_SYMBOLS[card.suit];
                  const color = SUIT_COLORS[card.suit];
                  return (
                    <View key={`${card.id}-${i}`} style={styles.miniCard}>
                      <Text style={[styles.miniRank, { color }]}>{card.rank}</Text>
                      <Text style={[styles.miniSuit, { color }]}>{symbol}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#0E1E2E',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxHeight: '65%',
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetTitle: {
    ...typography.subtitle,
    color: palette.gold,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: '#94A3B8',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  tabsRow: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 44,
  },
  tabItemActive: {
    borderColor: palette.gold,
    backgroundColor: 'rgba(245, 200, 76, 0.15)',
  },
  tabChip: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tabText: {
    ...typography.caption,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.gold,
  },
  cardsScroll: {
    padding: spacing.lg,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  miniCard: {
    width: 48,
    height: 68,
    borderRadius: radius.xs,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  miniRank: {
    fontSize: 14,
    fontWeight: '900',
  },
  miniSuit: {
    fontSize: 16,
    fontWeight: '900',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyIcon: {
    fontSize: 40,
    color: 'rgba(255, 255, 255, 0.2)',
  },
  emptyText: {
    ...typography.subtitle,
    color: '#FFFFFF',
  },
  emptySubtext: {
    ...typography.caption,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 240,
  },
});
