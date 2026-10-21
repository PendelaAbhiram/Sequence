// ─────────────────────────────────────────────────────────────────────────────
// BoardView – 10x10 Grid with Pinch-to-Zoom & Double-Tap Zoom Auto-Fit
// 100% Reanimated Worklet-Safe Gestures (Zero React-Native Animated.Value)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { Cell } from '../engine/types';
import { BoardCellView } from './BoardCellView';
import { radius } from '../theme';

interface BoardViewProps {
  board: Cell[][];
  cellSize: number;
  validTargets: [number, number][];
  lastMoveCell: [number, number] | null;
  lastMoveType?: 'place' | 'remove' | 'discard_dead';
  highlightedSequenceCells?: [number, number][];
  onCellPress: (r: number, c: number) => void;
  isInteractive: boolean;
}

export const BoardView: React.FC<BoardViewProps> = ({
  board,
  cellSize,
  validTargets,
  lastMoveCell,
  lastMoveType = 'place',
  highlightedSequenceCells = [],
  onCellPress,
  isInteractive,
}) => {
  // ── Worklet-safe Reanimated shared values (no Animated.Value or refs) ────────
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Fast set lookup for valid targets
  const targetKeys = useMemo(() => {
    return new Set(validTargets.map(([r, c]) => `${r},${c}`));
  }, [validTargets]);

  const sequenceCellKeys = useMemo(() => {
    return new Set(highlightedSequenceCells.map(([r, c]) => `${r},${c}`));
  }, [highlightedSequenceCells]);

  // Double-tap to toggle between 1x (auto-fit) and 1.6x zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      const nextScale = scale.value > 1.1 ? 1 : 1.6;
      scale.value = withSpring(nextScale, {
        damping: 15,
        stiffness: 150,
      });
      savedScale.value = nextScale;
    });

  // Continuous pinch-to-zoom (1.0x to 2.2x)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      const newScale = Math.min(Math.max(1, savedScale.value * e.scale), 2.2);
      scale.value = newScale;
    })
    .onEnd((e) => {
      'worklet';
      const finalScale = Math.min(Math.max(1, savedScale.value * e.scale), 2.2);
      if (finalScale < 1.05) {
        scale.value = withSpring(1, { damping: 18 });
        savedScale.value = 1;
      } else {
        scale.value = withSpring(finalScale, { damping: 18 });
        savedScale.value = finalScale;
      }
    });

  const combinedGesture = Gesture.Race(doubleTapGesture, pinchGesture);

  const animatedBoardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const boardWidth = cellSize * 10;

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View
        style={[
          styles.boardOuterContainer,
          {
            width: boardWidth,
            height: boardWidth,
          },
          animatedBoardStyle,
        ]}
      >
        <View style={styles.gridContainer}>
          {board.map((row, r) => (
            <View key={r} style={styles.rowContainer}>
              {row.map((cell, c) => {
                const isValid = targetKeys.has(`${r},${c}`);
                const isLast = lastMoveCell?.[0] === r && lastMoveCell?.[1] === c;
                const isRemove = isLast && lastMoveType === 'remove';
                const isSeq = sequenceCellKeys.has(`${r},${c}`);

                return (
                  <BoardCellView
                    key={`${r}-${c}`}
                    cell={cell}
                    size={cellSize}
                    isValidTarget={isValid}
                    isLastMove={isLast && !isRemove}
                    isLastRemove={isRemove}
                    isPartOfSequence={isSeq}
                    onPress={() => onCellPress(r, c)}
                    disabled={!isInteractive}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  boardOuterContainer: {
    borderRadius: radius.md,
    borderWidth: 2.5,
    borderColor: 'rgba(245, 200, 76, 0.45)',
    backgroundColor: '#071624',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  rowContainer: {
    flexDirection: 'row',
  },
});
