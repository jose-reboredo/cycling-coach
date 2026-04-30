import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeTabsEnabled, useClubsEnabled } from '../featureFlags';

// vitest's happy-dom environment copies own properties from the BrowserWindow
// onto the test global, but `localStorage` and `matchMedia` are prototype
// getters so they don't make it into the global automatically. We stub both
// with vi.stubGlobal before the tests run.

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

function stubMatchMedia(isMobile: boolean) {
  const mql: Partial<MediaQueryList> = {
    matches: isMobile,
    media: '(max-width: 1023px)',
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  vi.stubGlobal('matchMedia', () => mql as MediaQueryList);
  // Also stub on window since the hook reads window.matchMedia explicitly.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => mql as MediaQueryList,
  });
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

describe('computeTabsEnabled — viewport-aware default (v9.3.1)', () => {
  it('returns true on mobile (<1024px) when localStorage has no override', () => {
    stubMatchMedia(true);
    expect(computeTabsEnabled()).toBe(true);
  });

  it('returns false on desktop (≥1024px) when localStorage has no override', () => {
    stubMatchMedia(false);
    expect(computeTabsEnabled()).toBe(false);
  });

  it("returns true when cc_tabsEnabled='true' even on desktop (override wins)", () => {
    stubMatchMedia(false);
    fakeStorage.setItem('cc_tabsEnabled', 'true');
    expect(computeTabsEnabled()).toBe(true);
  });

  it("returns false when cc_tabsEnabled='false' even on mobile (kill-switch)", () => {
    stubMatchMedia(true);
    fakeStorage.setItem('cc_tabsEnabled', 'false');
    expect(computeTabsEnabled()).toBe(false);
  });

  it("falls through to viewport for any non-'true'/'false' value", () => {
    stubMatchMedia(true);
    for (const val of ['', '1', 'yes', 'TRUE', '0']) {
      fakeStorage.setItem('cc_tabsEnabled', val);
      expect(computeTabsEnabled(), `mobile + value "${val}"`).toBe(true);
    }
    stubMatchMedia(false);
    for (const val of ['', '1', 'yes', 'TRUE', '0']) {
      fakeStorage.setItem('cc_tabsEnabled', val);
      expect(computeTabsEnabled(), `desktop + value "${val}"`).toBe(false);
    }
  });
});

describe('useClubsEnabled', () => {
  it('defaults to true when localStorage has no cc_clubsEnabled key', () => {
    expect(useClubsEnabled()).toBe(true);
  });

  it("returns false when cc_clubsEnabled is 'false'", () => {
    fakeStorage.setItem('cc_clubsEnabled', 'false');
    expect(useClubsEnabled()).toBe(false);
  });
});
