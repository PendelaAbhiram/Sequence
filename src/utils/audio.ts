// ─────────────────────────────────────────────────────────────────────────────
// Sequence – High Performance Audio Manager & Synthesizer
// Supports Web Audio API synthesis (zero network/offline ready) and expo-av
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import { Audio } from 'expo-av';

class AudioManager {
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = false;
  private audioCtx: any = null;
  private bgmInterval: any = null;
  private nativeSounds: Record<string, Audio.Sound | null> = {};

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      } catch (e) {
        // AudioContext not supported
      }
    }
  }

  private ensureAudioContextRunning() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startBgmLoop();
    } else {
      this.stopBgmLoop();
    }
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    return this.soundEnabled;
  }

  public toggleMusic(): boolean {
    const next = !this.musicEnabled;
    this.setMusicEnabled(next);
    return next;
  }

  // ── SOUND EFFECT: Chip Placement Click ─────────────────────────────────────
  public playChipClick() {
    if (!this.soundEnabled) return;
    this.ensureAudioContextRunning();

    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        // Two high-frequency ceramic resonant pings
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1900, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.045);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.055);

        // Secondary subtle bounce tap
        const bounceOsc = this.audioCtx.createOscillator();
        const bounceGain = this.audioCtx.createGain();

        bounceOsc.type = 'sine';
        bounceOsc.frequency.setValueAtTime(1200, now + 0.06);
        bounceOsc.frequency.exponentialRampToValueAtTime(500, now + 0.09);

        bounceGain.gain.setValueAtTime(0.2, now + 0.06);
        bounceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        bounceOsc.connect(bounceGain);
        bounceGain.connect(this.audioCtx.destination);

        bounceOsc.start(now + 0.06);
        bounceOsc.stop(now + 0.11);
      } catch {}
    }
  }

  // ── SOUND EFFECT: Card Shuffle & Deal ──────────────────────────────────────
  public playCardShuffle() {
    if (!this.soundEnabled) return;
    this.ensureAudioContextRunning();

    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const count = 6;
        for (let i = 0; i < count; i++) {
          const t = now + i * 0.04;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(450 + Math.random() * 200, t);
          osc.frequency.exponentialRampToValueAtTime(150, t + 0.035);

          gain.gain.setValueAtTime(0.18, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(t);
          osc.stop(t + 0.045);
        }
      } catch {}
    }
  }

  // ── SOUND EFFECT: One-Eyed Jack Chip Shatter / Removal ─────────────────────
  public playChipRemove() {
    if (!this.soundEnabled) return;
    this.ensureAudioContextRunning();

    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.21);
      } catch {}
    }
  }

  // ── SOUND EFFECT: Sequence Formed Jingle (Ascending 5 notes) ──────────────
  public playSequenceJingle() {
    if (!this.soundEnabled) return;
    this.ensureAudioContextRunning();

    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        // C5, E5, G5, B5, C6 frequencies
        const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];

        notes.forEach((freq, idx) => {
          const t = now + idx * 0.09;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(t);
          osc.stop(t + 0.3);
        });
      } catch {}
    }
  }

  // ── SOUND EFFECT: Victory Fanfare ──────────────────────────────────────────
  public playWinFanfare() {
    if (!this.soundEnabled) return;
    this.ensureAudioContextRunning();

    if (this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        // Joyful fanfare: G4 -> C5 -> E5 -> G5, followed by rich major chord
        const arpeggio = [
          { f: 392.0, t: 0, d: 0.14 },
          { f: 523.25, t: 0.14, d: 0.14 },
          { f: 659.25, t: 0.28, d: 0.14 },
          { f: 783.99, t: 0.42, d: 0.5 },
        ];

        arpeggio.forEach(({ f, t, d }) => {
          const startTime = now + t;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, startTime);

          gain.gain.setValueAtTime(0.4, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + d);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(startTime);
          osc.stop(startTime + d + 0.05);
        });

        // Final rich triumphant chord (C5 + E5 + G5 + C6)
        const chordTime = now + 0.7;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, chordTime);

          gain.gain.setValueAtTime(0.25, chordTime);
          gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 1.2);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(chordTime);
          osc.stop(chordTime + 1.25);
        });
      } catch {}
    }
  }

  // ── BACKGROUND MUSIC: Lo-Fi Ambient Chord Progression Loop ─────────────────
  private startBgmLoop() {
    this.stopBgmLoop();
    if (!this.musicEnabled) return;
    this.ensureAudioContextRunning();

    // Progression: Dm9 (D3, F4, A4, C5, E5) -> G13 -> Cmaj9 -> Am9
    const chords = [
      [146.83, 349.23, 440.0, 523.25, 659.25], // Dm9
      [196.0, 329.63, 392.0, 493.88, 659.25],  // G13
      [130.81, 329.63, 392.0, 493.88, 523.25], // Cmaj9
      [220.0, 329.63, 440.0, 523.25, 659.25],  // Am9
    ];

    let chordIdx = 0;

    const playNextChord = () => {
      if (!this.musicEnabled || !this.audioCtx) return;
      try {
        const now = this.audioCtx.currentTime;
        const freqs = chords[chordIdx];
        chordIdx = (chordIdx + 1) % chords.length;

        freqs.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          // Gentle soft envelope
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.045 / (idx === 0 ? 1 : 2), now + 0.4);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 2.7);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(now);
          osc.stop(now + 2.8);
        });
      } catch {}
    };

    playNextChord();
    this.bgmInterval = setInterval(playNextChord, 2800);
  }

  private stopBgmLoop() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const soundManager = new AudioManager();
