// Typed localStorage wrapper. Keeps the `cc_` prefix consistent with the
// legacy Worker so existing users don't lose their stored preferences.

const PREFIX = 'cc_';

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

function del(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

export const storage = { get, set, del };

// Storage keys — single source of truth.
export const KEYS = {
  apiKey: 'anthropicKey',
  trainingPrefs: 'trainingPrefs',
  aiReport: 'aiReport',
  rideFeedback: 'rideFeedback',
  surfacePref: 'surfacePref',
  startAddress: 'startAddress',
} as const;
