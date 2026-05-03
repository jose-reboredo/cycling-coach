// apps/web/src/lib/validation.ts
//
// Sprint 13 / v11.2.0 — shared client + server profile validation.
//
// Imported by:
//   - apps/web/src/routes/dashboard.you.tsx  (client form)
//   - src/worker.js                          (server endpoint)
//
// Drift-locked by apps/web/src/lib/__tests__/profile-contract.test.ts.

export const PROFILE_GENDERS = [
  'prefer-not-to-say',
  'woman',
  'man',
  'non-binary',
  'self-describe',
] as const;

export type ProfileGender = (typeof PROFILE_GENDERS)[number];

export const PROFILE_LIMITS = {
  name: { max: 80 },
  dob: { minYear: 1900 },
  city: { max: 64 },
  country: { regex: /^[A-Z]{2}$/ },
  ftp: { min: 50, max: 600 },
  weight_kg: { min: 30, max: 200 },
  hr_max: { min: 100, max: 230 },
} as const;

export function validateName(value: string): string | null {
  if (value.length > PROFILE_LIMITS.name.max) {
    return `Name must be at most ${PROFILE_LIMITS.name.max} characters.`;
  }
  return null;
}

export function validateDob(epochSeconds: number): string | null {
  const min = new Date(`${PROFILE_LIMITS.dob.minYear}-01-01`).getTime() / 1000;
  const max = Date.now() / 1000;
  if (epochSeconds < min) return `Date of birth must be on or after ${PROFILE_LIMITS.dob.minYear}-01-01.`;
  if (epochSeconds > max) return 'Date of birth cannot be in the future.';
  return null;
}

export function validateCity(value: string): string | null {
  if (value.length > PROFILE_LIMITS.city.max) {
    return `City must be at most ${PROFILE_LIMITS.city.max} characters.`;
  }
  return null;
}

export function validateCountry(value: string): string | null {
  if (!PROFILE_LIMITS.country.regex.test(value)) {
    return 'Country must be a 2-letter ISO 3166 code (e.g. CH, GB, US).';
  }
  return null;
}

export function validateFtp(value: number): string | null {
  const { min, max } = PROFILE_LIMITS.ftp;
  if (!Number.isFinite(value) || value < min || value > max) {
    return `FTP must be between ${min} and ${max} watts.`;
  }
  return null;
}

export function validateWeightKg(value: number): string | null {
  const { min, max } = PROFILE_LIMITS.weight_kg;
  if (!Number.isFinite(value) || value < min || value > max) {
    return `Weight must be between ${min} and ${max} kg.`;
  }
  return null;
}

export function validateHrMax(value: number): string | null {
  const { min, max } = PROFILE_LIMITS.hr_max;
  if (!Number.isFinite(value) || value < min || value > max) {
    return `HR Max must be between ${min} and ${max} bpm.`;
  }
  return null;
}

export function validateGender(value: string): string | null {
  if (!PROFILE_GENDERS.includes(value as ProfileGender)) {
    return `Gender is invalid. Use one of: ${PROFILE_GENDERS.join(', ')}.`;
  }
  return null;
}
