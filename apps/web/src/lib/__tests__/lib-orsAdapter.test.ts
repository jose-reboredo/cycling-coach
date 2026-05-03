// Sprint 11 — pure-helper tests for src/lib/orsAdapter.js.
// Only `profileForCyclingType` is testable as a pure function (the
// `requestOrsRoute` export does HTTP). Trivial, but pinned because a
// silent profile change shifts every generated route.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — JS module
import { profileForCyclingType } from '../../../../../src/lib/orsAdapter.js';

describe('lib/orsAdapter profileForCyclingType', () => {
  it('maps road → cycling-road', () => {
    expect(profileForCyclingType('road')).toBe('cycling-road');
  });

  it('maps mtb → cycling-mountain', () => {
    expect(profileForCyclingType('mtb')).toBe('cycling-mountain');
  });

  it('maps gravel → cycling-regular (ORS has no native gravel)', () => {
    // Documented: surface-scoring promotes unpaved-friendly routes from
    // cycling-regular candidates. Test pins the documented contract.
    expect(profileForCyclingType('gravel')).toBe('cycling-regular');
  });

  it('falls back to cycling-regular for unknown types', () => {
    expect(profileForCyclingType('unknown')).toBe('cycling-regular');
    expect(profileForCyclingType(undefined)).toBe('cycling-regular');
  });
});
