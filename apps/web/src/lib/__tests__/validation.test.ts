// apps/web/src/lib/__tests__/validation.test.ts
//
// Sprint 13 / v11.2.0 — shared profile validation contract.

import { describe, it, expect } from 'vitest';
import {
  PROFILE_LIMITS,
  PROFILE_GENDERS,
  validateName,
  validateDob,
  validateCity,
  validateCountry,
  validateFtp,
  validateWeightKg,
  validateHrMax,
  validateGender,
} from '../validation';

describe('validation — name', () => {
  it('accepts up to 80 chars', () => {
    expect(validateName('Marco Bianchi')).toBe(null);
    expect(validateName('a'.repeat(80))).toBe(null);
    expect(validateName('a'.repeat(81))).toMatch(/at most 80/i);
  });
  it('accepts empty (nullable field)', () => {
    expect(validateName('')).toBe(null);
  });
});

describe('validation — dob', () => {
  it('rejects pre-1900 + future', () => {
    const before1900 = new Date('1899-12-31').getTime() / 1000;
    const future = (Date.now() + 86400_000) / 1000;
    expect(validateDob(before1900)).toMatch(/1900/);
    expect(validateDob(future)).toMatch(/future/i);
  });
  it('accepts a valid epoch', () => {
    const ok = new Date('1990-06-15').getTime() / 1000;
    expect(validateDob(ok)).toBe(null);
  });
});

describe('validation — city', () => {
  it('accepts up to 64 chars', () => {
    expect(validateCity('Zürich')).toBe(null);
    expect(validateCity('a'.repeat(64))).toBe(null);
    expect(validateCity('a'.repeat(65))).toMatch(/64/);
  });
});

describe('validation — country', () => {
  it('accepts ISO 3166-1 alpha-2', () => {
    expect(validateCountry('CH')).toBe(null);
    expect(validateCountry('GB')).toBe(null);
    expect(validateCountry('USA')).toMatch(/2-letter/i);
    expect(validateCountry('ch')).toMatch(/2-letter/i);
  });
});

describe('validation — performance numbers', () => {
  it('FTP 50–600', () => {
    expect(validateFtp(285)).toBe(null);
    expect(validateFtp(49)).toMatch(/50/);
    expect(validateFtp(601)).toMatch(/600/);
  });
  it('weight 30–200', () => {
    expect(validateWeightKg(72)).toBe(null);
    expect(validateWeightKg(29)).toMatch(/30/);
    expect(validateWeightKg(201)).toMatch(/200/);
  });
  it('HR Max 100–230', () => {
    expect(validateHrMax(188)).toBe(null);
    expect(validateHrMax(99)).toMatch(/100/);
    expect(validateHrMax(231)).toMatch(/230/);
  });
});

describe('validation — gender', () => {
  it('accepts the documented enum values', () => {
    for (const g of PROFILE_GENDERS) expect(validateGender(g)).toBe(null);
    expect(validateGender('made-up')).toMatch(/invalid/i);
  });
});

describe('validation — limits constants exported', () => {
  it('exports PROFILE_LIMITS', () => {
    expect(PROFILE_LIMITS.name.max).toBe(80);
    expect(PROFILE_LIMITS.ftp.min).toBe(50);
    expect(PROFILE_LIMITS.country.regex.source).toBe('^[A-Z]{2}$');
  });
});
