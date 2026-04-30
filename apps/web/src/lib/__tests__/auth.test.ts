// Vitest unit tests for auth.ts — writeTokens / clearTokens Safari private
// mode safety (#39): localStorage throwing QuotaExceededError must not
// propagate to callers.
//
// Note: vitest's happy-dom environment doesn't expose localStorage as a
// test global (it's a prototype getter on BrowserWindow). We stub it the
// same way featureFlags.test.ts does: vi.stubGlobal + Object.defineProperty.

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { writeTokens, clearTokens, readTokens } from '../auth';
import type { StravaTokens } from '../auth';

const sample: StravaTokens = {
  access_token: 'abc',
  refresh_token: 'def',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

function makeStorage(): Storage {
  const data: Record<string, string> = {};
  return {
    get length() { return Object.keys(data).length; },
    key: (i) => Object.keys(data)[i] ?? null,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const k of Object.keys(data)) delete data[k]; },
  } as Storage;
}

let fakeStorage: Storage;

beforeEach(() => {
  fakeStorage = makeStorage();
  vi.stubGlobal('localStorage', fakeStorage);
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: fakeStorage,
  });
});

describe('auth — writeTokens / clearTokens (Safari private mode)', () => {
  test('writeTokens persists tokens to localStorage normally', () => {
    writeTokens(sample);
    expect(readTokens()).toMatchObject({ access_token: 'abc' });
  });

  test('writeTokens does NOT throw when localStorage.setItem throws (Safari private mode)', () => {
    vi.spyOn(fakeStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => writeTokens(sample)).not.toThrow();
  });

  test('clearTokens does NOT throw when localStorage.removeItem throws', () => {
    vi.spyOn(fakeStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => clearTokens()).not.toThrow();
  });
});
