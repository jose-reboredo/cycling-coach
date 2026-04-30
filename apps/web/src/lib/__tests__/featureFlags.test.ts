import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTabsEnabled, useClubsEnabled } from '../featureFlags';

// vitest's happy-dom environment copies own properties from the BrowserWindow
// onto the test global, but `localStorage` is a prototype getter so it doesn't
// make it into the global automatically. We stub it with vi.stubGlobal before
// the tests run and restore + clear between cases.

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
});

describe('useTabsEnabled', () => {
  it('returns false when localStorage has no cc_tabsEnabled key', () => {
    expect(useTabsEnabled()).toBe(false);
  });

  it("returns true when cc_tabsEnabled is 'true'", () => {
    fakeStorage.setItem('cc_tabsEnabled', 'true');
    expect(useTabsEnabled()).toBe(true);
  });

  it("returns false for any non-'true' value ('false', '1', '', 'yes')", () => {
    for (const val of ['false', '1', '', 'yes', 'TRUE', '0']) {
      fakeStorage.setItem('cc_tabsEnabled', val);
      expect(useTabsEnabled(), `expected false for value "${val}"`).toBe(false);
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
