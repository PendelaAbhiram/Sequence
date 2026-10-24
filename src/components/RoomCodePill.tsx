// ─────────────────────────────────────────────────────────────────────────────
// RoomCodePill – Persistent Online Room Code Pill with Copy & Native Share Sheet
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Share,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useOnlineStore } from '../store/onlineStore';
import { palette, radius, typography } from '../theme';

export interface RoomCodePillProps {
  roomCode?: string | null;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export const RoomCodePill: React.FC<RoomCodePillProps> = ({
  roomCode: explicitCode,
  style,
  compact = false,
}) => {
  const storeRoomCode = useOnlineStore((s) => s.room?.roomCode ?? s.gameState?.roomCode);
  const code = (explicitCode ?? storeRoomCode ?? '').trim().toUpperCase();

  const [copied, setCopied] = useState(false);

  if (!code) return null;

  const handleCopy = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard error:', e);
    }
  };

  const handleShare = async (e: any) => {
    e.stopPropagation?.();
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    try {
      await Share.share({
        message: `Join my Sequence game! Room code: ${code}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={handleCopy}
        style={[styles.pill, compact && styles.pillCompact, style]}
        accessibilityRole="button"
        accessibilityLabel={`Room code ${code}. Tap to copy, tap share icon to share.`}
      >
        <Text style={styles.roomTag}>ROOM</Text>
        <Text style={styles.codeText}>{code}</Text>

        {copied ? (
          <View style={styles.copiedBadge}>
            <Text style={styles.copiedText}>✓ Copied</Text>
          </View>
        ) : (
          <View style={styles.iconsRow}>
            <Text style={styles.copyIcon} accessibilityLabel="Copy code">📋</Text>
            <TouchableOpacity
              activeOpacity={0.65}
              onPress={handleShare}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={styles.shareBtn}
              accessibilityLabel="Share room code"
            >
              <Text style={styles.shareIcon}>🔗</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.2,
    borderColor: 'rgba(245, 200, 76, 0.45)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  pillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  roomTag: {
    fontSize: 9.5,
    fontWeight: '800',
    color: palette.gold,
    letterSpacing: 0.8,
  },
  codeText: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      web: 'monospace',
      default: 'monospace',
    }),
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  iconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 2,
  },
  copyIcon: {
    fontSize: 11,
    opacity: 0.85,
  },
  shareBtn: {
    padding: 2,
  },
  shareIcon: {
    fontSize: 11,
    color: palette.gold,
    opacity: 0.95,
  },
  copiedBadge: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.full,
    marginLeft: 2,
  },
  copiedText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
