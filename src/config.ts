// ─────────────────────────────────────────────────────────────────────────────
// Sequence Mobile App – Server & Environment Configuration
// Switch seamlessly between local development and production deployments (Render/Railway)
// ─────────────────────────────────────────────────────────────────────────────

export type AppEnvironment = 'development' | 'production';

// ── Known Server Endpoints ──────────────────────────────────────────────────
export const SERVER_ENDPOINTS = {
  // Local development URL (LAN IP for testing on physical phone / Expo Go)
  development: process.env.EXPO_PUBLIC_LOCAL_SERVER_URL || 'http://192.168.29.101:3001',
  // Production server URL (e.g. Render / Railway Web Service)
  production: process.env.EXPO_PUBLIC_PROD_SERVER_URL || 'https://sequence-server.onrender.com',
};

// ── Active Environment Resolution ───────────────────────────────────────────
// Explicitly controlled via EXPO_PUBLIC_APP_ENV ('development' | 'production'),
// or automatically determined by Expo/React Native's __DEV__ flag.
const explicitEnv = process.env.EXPO_PUBLIC_APP_ENV as AppEnvironment | undefined;
export const CURRENT_ENV: AppEnvironment =
  explicitEnv || (typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production');

export const isProduction = CURRENT_ENV === 'production';

// ── Resolved Server URL ─────────────────────────────────────────────────────
// Priority:
// 1. Explicit EXPO_PUBLIC_SERVER_URL (highest priority override)
// 2. Active environment endpoint (development vs production)
// 3. Local fallback
export const SERVER_URL: string =
  process.env.EXPO_PUBLIC_SERVER_URL ||
  SERVER_ENDPOINTS[CURRENT_ENV] ||
  SERVER_ENDPOINTS.development;

export const APP_CONFIG = {
  env: CURRENT_ENV,
  serverUrl: SERVER_URL,
  endpoints: SERVER_ENDPOINTS,
  isProduction,
};
