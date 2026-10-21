// ─────────────────────────────────────────────────────────────────────────────
// AsyncStorage Wrapper with Memory Fallback for Jest/SSR
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore: Record<string, string> = {};

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, value);
      }
    } catch {
      // Fallback
    }
    memoryStore[key] = value;
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const val = await AsyncStorage.getItem(key);
        if (val !== null && val !== undefined) return val;
      }
    } catch {
      // Fallback
    }
    return memoryStore[key] ?? null;
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Fallback
    }
    delete memoryStore[key];
  },

  async clear(): Promise<void> {
    try {
      if (AsyncStorage && typeof AsyncStorage.clear === 'function') {
        await AsyncStorage.clear();
      }
    } catch {
      // Fallback
    }
    for (const k of Object.keys(memoryStore)) {
      delete memoryStore[k];
    }
  },
};

export interface PlayerRoomSession {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  playerName: string;
  seat: number;
  teamId?: string;
  savedAt: number;
}

/**
 * Persist player's private reconnect token on the device
 */
export async function savePlayerRoomSession(session: PlayerRoomSession): Promise<void> {
  const key = `sequence_room_session_${session.roomCode.trim().toUpperCase()}`;
  await storage.setItem(key, JSON.stringify(session));
}

/**
 * Retrieve saved private reconnect session from the device
 */
export async function getPlayerRoomSession(roomCode: string): Promise<PlayerRoomSession | null> {
  const key = `sequence_room_session_${roomCode.trim().toUpperCase()}`;
  const raw = await storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Remove saved room session from the device
 */
export async function clearPlayerRoomSession(roomCode: string): Promise<void> {
  const key = `sequence_room_session_${roomCode.trim().toUpperCase()}`;
  await storage.removeItem(key);
}

