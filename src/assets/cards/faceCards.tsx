// ─────────────────────────────────────────────────────────────────────────────
// Face Card Illustrated Figures (King, Queen, Jack) for Sequence Playing Cards
// Inspired by traditional Byron Knoll vector playing card court motifs
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { G, Rect, Path, Circle, Text as SvgText, Line } from 'react-native-svg';
import { Rank, Suit } from '../../engine/types';

interface CourtFigureProps {
  rank: Rank;
  suit: Suit;
}

export const CourtPanel: React.FC<CourtFigureProps> = ({ rank, suit }) => {
  const isOneEyed = rank === 'J' && (suit === 'spades' || suit === 'hearts');
  const isTwoEyed = rank === 'J' && (suit === 'diamonds' || suit === 'clubs');

  return (
    <G>
      {/* Outer Court Panel Container (20, 22, 60x96) */}
      <Rect
        x="20"
        y="22"
        width="60"
        height="96"
        rx="4"
        fill="#FCFBF7"
        stroke="#D4AF37"
        strokeWidth="1.2"
      />

      {/* Decorative Inner Filigree Border */}
      <Rect
        x="22"
        y="24"
        width="56"
        height="92"
        rx="2"
        fill="none"
        stroke="#E2E8F0"
        strokeWidth="0.8"
      />

      {/* Corner Corner Flourishes inside panel */}
      <Path d="M 23 30 L 23 25 L 28 25" stroke="#D4AF37" strokeWidth="1" fill="none" />
      <Path d="M 77 30 L 77 25 L 72 25" stroke="#D4AF37" strokeWidth="1" fill="none" />
      <Path d="M 23 110 L 23 115 L 28 115" stroke="#D4AF37" strokeWidth="1" fill="none" />
      <Path d="M 77 110 L 77 115 L 72 115" stroke="#D4AF37" strokeWidth="1" fill="none" />

      {/* Figure Content */}
      {rank === 'K' && <KingFigure />}
      {rank === 'Q' && <QueenFigure />}
      {rank === 'J' && (isOneEyed ? <OneEyedJackFigure /> : <TwoEyedJackFigure />)}

      {/* Center Dividing Royal Sash */}
      <Line x1="22" y1="70" x2="78" y2="70" stroke="#D4AF37" strokeWidth="1" />
      <Circle cx="50" cy="70" r="3.5" fill="#D4AF37" />
      <Circle cx="50" cy="70" r="1.8" fill="#FFFFFF" />

      {/* Wild / Remove Badges on Jacks */}
      {isTwoEyed && (
        <G>
          <Rect
            x="24"
            y="61"
            width="52"
            height="18"
            rx="9"
            fill="#F59E0B"
            stroke="#FFFFFF"
            strokeWidth="1.2"
          />
          <SvgText
            x="50"
            y="74"
            fill="#0F172A"
            fontSize="9"
            fontWeight="900"
            textAnchor="middle"
            letterSpacing="0.8"
          >
            ★ WILD ★
          </SvgText>
        </G>
      )}

      {isOneEyed && (
        <G>
          <Rect
            x="22"
            y="61"
            width="56"
            height="18"
            rx="9"
            fill="#DC2626"
            stroke="#FFFFFF"
            strokeWidth="1.2"
          />
          <SvgText
            x="50"
            y="74"
            fill="#FFFFFF"
            fontSize="8.5"
            fontWeight="900"
            textAnchor="middle"
            letterSpacing="0.8"
          >
            ✕ REMOVE ✕
          </SvgText>
        </G>
      )}
    </G>
  );
};

// ── KING FIGURE (Symmetric / Mirrored Court King) ───────────────────────────
const KingFigure = () => (
  <G>
    {/* Upper Half (y: 25 to 70) */}
    <G>
      {/* Robe shoulders (Royal Blue & Crimson) */}
      <Path d="M 27 68 C 27 52 32 46 50 46 C 68 46 73 52 73 68 Z" fill="#1E3A8A" />
      <Path d="M 33 68 C 33 55 38 48 50 48 C 62 48 67 55 67 68 Z" fill="#B91C1C" />
      {/* Ermine / Gold Robe Trim */}
      <Path d="M 46 48 L 46 68 L 54 68 L 54 48 Z" fill="#F5C84C" />
      <Line x1="50" y1="48" x2="50" y2="68" stroke="#78350F" strokeWidth="0.8" />

      {/* Head / Neck */}
      <Rect x="44" y="44" width="12" height="7" fill="#FED7AA" rx="2" />
      {/* Face */}
      <Circle cx="50" cy="40" r="9" fill="#FED7AA" />
      {/* Royal Beard & Moustache */}
      <Path d="M 43 41 C 45 48 55 48 57 41 C 54 44 46 44 43 41 Z" fill="#92400E" />
      <Path d="M 45 39 C 48 42 52 42 55 39 Z" stroke="#78350F" strokeWidth="0.8" fill="none" />
      {/* Eyes */}
      <Circle cx="47" cy="37" r="1.1" fill="#0F172A" />
      <Circle cx="53" cy="37" r="1.1" fill="#0F172A" />

      {/* Gold Crown */}
      <Path
        d="M 41 33 L 41 27 L 45 30 L 50 25 L 55 30 L 59 27 L 59 33 Z"
        fill="#F59E0B"
        stroke="#78350F"
        strokeWidth="0.8"
      />
      {/* Crown Jewels */}
      <Circle cx="50" cy="28" r="1.2" fill="#DC2626" />
      <Circle cx="44" cy="30" r="0.9" fill="#2563EB" />
      <Circle cx="56" cy="30" r="0.9" fill="#2563EB" />

      {/* Royal Sword / Scepter on side */}
      <Line x1="68" y1="36" x2="68" y2="65" stroke="#F5C84C" strokeWidth="1.8" />
      <Line x1="64" y1="44" x2="72" y2="44" stroke="#D97706" strokeWidth="1.5" />
      <Circle cx="68" cy="35" r="2" fill="#DC2626" />
    </G>

    {/* Inverted Lower Half (Rotated 180° around 50, 70) */}
    <G transform="rotate(180, 50, 70)">
      <Path d="M 27 68 C 27 52 32 46 50 46 C 68 46 73 52 73 68 Z" fill="#1E3A8A" />
      <Path d="M 33 68 C 33 55 38 48 50 48 C 62 48 67 55 67 68 Z" fill="#B91C1C" />
      <Path d="M 46 48 L 46 68 L 54 68 L 54 48 Z" fill="#F5C84C" />
      <Line x1="50" y1="48" x2="50" y2="68" stroke="#78350F" strokeWidth="0.8" />
      <Rect x="44" y="44" width="12" height="7" fill="#FED7AA" rx="2" />
      <Circle cx="50" cy="40" r="9" fill="#FED7AA" />
      <Path d="M 43 41 C 45 48 55 48 57 41 C 54 44 46 44 43 41 Z" fill="#92400E" />
      <Circle cx="47" cy="37" r="1.1" fill="#0F172A" />
      <Circle cx="53" cy="37" r="1.1" fill="#0F172A" />
      <Path
        d="M 41 33 L 41 27 L 45 30 L 50 25 L 55 30 L 59 27 L 59 33 Z"
        fill="#F59E0B"
        stroke="#78350F"
        strokeWidth="0.8"
      />
      <Circle cx="50" cy="28" r="1.2" fill="#DC2626" />
      <Line x1="68" y1="36" x2="68" y2="65" stroke="#F5C84C" strokeWidth="1.8" />
      <Line x1="64" y1="44" x2="72" y2="44" stroke="#D97706" strokeWidth="1.5" />
    </G>
  </G>
);

// ── QUEEN FIGURE (Symmetric / Mirrored Court Queen) ─────────────────────────
const QueenFigure = () => (
  <G>
    {/* Upper Half */}
    <G>
      {/* Gown & Bodice (Emerald & Crimson) */}
      <Path d="M 28 68 C 28 53 34 46 50 46 C 66 46 72 53 72 68 Z" fill="#047857" />
      <Path d="M 36 68 C 36 56 40 50 50 50 C 60 50 64 56 64 68 Z" fill="#B91C1C" />
      <Path d="M 47 50 L 47 68 L 53 68 L 53 50 Z" fill="#F5C84C" />

      {/* Flowing Queen Hair */}
      <Path d="M 40 40 C 37 46 38 56 42 60 L 58 60 C 62 56 63 46 60 40 Z" fill="#92400E" />

      {/* Face & Slender Neck */}
      <Rect x="46" y="44" width="8" height="6" fill="#FED7AA" />
      <Circle cx="50" cy="40" r="8" fill="#FED7AA" />
      {/* Eyes & Lip */}
      <Circle cx="47" cy="39" r="1" fill="#0F172A" />
      <Circle cx="53" cy="39" r="1" fill="#0F172A" />
      <Path d="M 48 44 C 49 45.5 51 45.5 52 44 Z" fill="#DC2626" />

      {/* Queen Tiara / Diadem */}
      <Path
        d="M 43 34 C 43 30 46 27 50 25 C 54 27 57 30 57 34 Z"
        fill="#F59E0B"
        stroke="#78350F"
        strokeWidth="0.8"
      />
      <Circle cx="50" cy="29" r="1.3" fill="#10B981" />
      <Circle cx="46" cy="32" r="0.8" fill="#DC2626" />
      <Circle cx="54" cy="32" r="0.8" fill="#DC2626" />

      {/* Holding Queen Scepter / Royal Rose */}
      <Line x1="32" y1="42" x2="32" y2="65" stroke="#F5C84C" strokeWidth="1.6" />
      <Circle cx="32" cy="41" r="3" fill="#DC2626" />
      <Circle cx="32" cy="41" r="1.2" fill="#F5C84C" />
    </G>

    {/* Inverted Lower Half */}
    <G transform="rotate(180, 50, 70)">
      <Path d="M 28 68 C 28 53 34 46 50 46 C 66 46 72 53 72 68 Z" fill="#047857" />
      <Path d="M 36 68 C 36 56 40 50 50 50 C 60 50 64 56 64 68 Z" fill="#B91C1C" />
      <Path d="M 47 50 L 47 68 L 53 68 L 53 50 Z" fill="#F5C84C" />
      <Path d="M 40 40 C 37 46 38 56 42 60 L 58 60 C 62 56 63 46 60 40 Z" fill="#92400E" />
      <Circle cx="50" cy="40" r="8" fill="#FED7AA" />
      <Circle cx="47" cy="39" r="1" fill="#0F172A" />
      <Circle cx="53" cy="39" r="1" fill="#0F172A" />
      <Path d="M 48 44 C 49 45.5 51 45.5 52 44 Z" fill="#DC2626" />
      <Path
        d="M 43 34 C 43 30 46 27 50 25 C 54 27 57 30 57 34 Z"
        fill="#F59E0B"
        stroke="#78350F"
        strokeWidth="0.8"
      />
      <Circle cx="50" cy="29" r="1.3" fill="#10B981" />
      <Line x1="32" y1="42" x2="32" y2="65" stroke="#F5C84C" strokeWidth="1.6" />
      <Circle cx="32" cy="41" r="3" fill="#DC2626" />
    </G>
  </G>
);

// ── TWO-EYED JACK FIGURE (Full frontal face, both eyes visible) ─────────────
const TwoEyedJackFigure = () => (
  <G>
    {/* Upper Half */}
    <G>
      {/* Squire Doublet & Shoulders */}
      <Path d="M 27 68 C 27 54 34 46 50 46 C 66 46 73 54 73 68 Z" fill="#0284C7" />
      <Path d="M 37 68 C 37 57 41 51 50 51 C 59 51 63 57 63 68 Z" fill="#D97706" />

      {/* Head / Neck */}
      <Rect x="45" y="44" width="10" height="7" fill="#FED7AA" />
      <Circle cx="50" cy="40" r="8" fill="#FED7AA" />

      {/* Frontal Face: Both Eyes Clearly Visible! */}
      <Circle cx="47" cy="39" r="1.2" fill="#0F172A" />
      <Circle cx="53" cy="39" r="1.2" fill="#0F172A" />
      <Line x1="48" y1="44" x2="52" y2="44" stroke="#78350F" strokeWidth="1" />

      {/* Cavalier Cap with Feather Plume */}
      <Path d="M 40 35 C 40 28 60 28 60 35 Z" fill="#DC2626" stroke="#78350F" strokeWidth="0.8" />
      <Path d="M 38 35 C 45 32 55 32 62 35 C 62 37 38 37 38 35 Z" fill="#F5C84C" />
      <Path d="M 54 30 C 62 25 66 22 69 25 C 66 28 62 31 56 31 Z" fill="#FFFFFF" />

      {/* Polearm / Lance held vertically */}
      <Line x1="68" y1="28" x2="68" y2="65" stroke="#475569" strokeWidth="2" />
      <Path d="M 68 24 L 71 29 L 65 29 Z" fill="#CBD5E1" stroke="#475569" strokeWidth="0.8" />
    </G>

    {/* Inverted Lower Half */}
    <G transform="rotate(180, 50, 70)">
      <Path d="M 27 68 C 27 54 34 46 50 46 C 66 46 73 54 73 68 Z" fill="#0284C7" />
      <Path d="M 37 68 C 37 57 41 51 50 51 C 59 51 63 57 63 68 Z" fill="#D97706" />
      <Circle cx="50" cy="40" r="8" fill="#FED7AA" />
      <Circle cx="47" cy="39" r="1.2" fill="#0F172A" />
      <Circle cx="53" cy="39" r="1.2" fill="#0F172A" />
      <Path d="M 40 35 C 40 28 60 28 60 35 Z" fill="#DC2626" stroke="#78350F" strokeWidth="0.8" />
      <Path d="M 38 35 C 45 32 55 32 62 35 C 62 37 38 37 38 35 Z" fill="#F5C84C" />
      <Line x1="68" y1="28" x2="68" y2="65" stroke="#475569" strokeWidth="2" />
      <Path d="M 68 24 L 71 29 L 65 29 Z" fill="#CBD5E1" stroke="#475569" strokeWidth="0.8" />
    </G>
  </G>
);

// ── ONE-EYED JACK FIGURE (Side Profile, exactly ONE eye visible) ────────────
const OneEyedJackFigure = () => (
  <G>
    {/* Upper Half */}
    <G>
      {/* Squire Profile Shoulders */}
      <Path d="M 26 68 C 26 53 34 46 50 46 C 66 46 74 53 74 68 Z" fill="#7C2D12" />
      <Path d="M 32 68 C 32 55 38 49 48 49 C 58 49 64 55 64 68 Z" fill="#1E3A8A" />

      {/* Profile Head looking left */}
      <Path
        d="M 54 33 C 54 33 46 33 43 37 C 41 39 39 40 38 41 C 41 42 41 43 43 45 C 44 49 52 49 54 46 Z"
        fill="#FED7AA"
      />
      {/* Single Prominent Eye in Profile! */}
      <Circle cx="42" cy="39" r="1.3" fill="#0F172A" />
      {/* Eyebrow */}
      <Path d="M 40 37 C 42 36 44 36 45 37" stroke="#78350F" strokeWidth="0.9" fill="none" />

      {/* Feathered Beret / Cap in Profile */}
      <Path d="M 41 34 C 43 27 57 28 58 35 Z" fill="#1E3A8A" />
      <Path d="M 40 34 C 45 33 55 33 59 35 Z" stroke="#F5C84C" strokeWidth="1.5" />
      {/* Red Sweeping Feather Plume */}
      <Path d="M 52 29 C 60 21 68 22 72 26 C 67 27 60 29 54 30 Z" fill="#DC2626" />

      {/* Halberd / Axe blade */}
      <Line x1="31" y1="28" x2="31" y2="65" stroke="#475569" strokeWidth="2" />
      <Path d="M 31 29 C 26 31 26 38 31 40 Z" fill="#94A3B8" stroke="#334155" strokeWidth="0.8" />
    </G>

    {/* Inverted Lower Half */}
    <G transform="rotate(180, 50, 70)">
      <Path d="M 26 68 C 26 53 34 46 50 46 C 66 46 74 53 74 68 Z" fill="#7C2D12" />
      <Path d="M 32 68 C 32 55 38 49 48 49 C 58 49 64 55 64 68 Z" fill="#1E3A8A" />
      <Path
        d="M 54 33 C 54 33 46 33 43 37 C 41 39 39 40 38 41 C 41 42 41 43 43 45 C 44 49 52 49 54 46 Z"
        fill="#FED7AA"
      />
      <Circle cx="42" cy="39" r="1.3" fill="#0F172A" />
      <Path d="M 41 34 C 43 27 57 28 58 35 Z" fill="#1E3A8A" />
      <Path d="M 40 34 C 45 33 55 33 59 35 Z" stroke="#F5C84C" strokeWidth="1.5" />
      <Path d="M 52 29 C 60 21 68 22 72 26 C 67 27 60 29 54 30 Z" fill="#DC2626" />
      <Line x1="31" y1="28" x2="31" y2="65" stroke="#475569" strokeWidth="2" />
      <Path d="M 31 29 C 26 31 26 38 31 40 Z" fill="#94A3B8" stroke="#334155" strokeWidth="0.8" />
    </G>
  </G>
);
