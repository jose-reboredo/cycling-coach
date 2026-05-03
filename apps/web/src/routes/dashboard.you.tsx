// apps/web/src/routes/dashboard.you.tsx
//
// Sprint 13 / v11.2.0 — My Account page (rebuild).
// 5 sections: Personal · Performance · AI Coach · Connections · Consent.
// First in-app surface to consume the v11.0.0 design system end-to-end.

import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { MigrationBanner } from '../components/MigrationBanner/MigrationBanner';
import { SetupPassphraseModal } from '../components/SetupPassphraseModal/SetupPassphraseModal';
import { useApiKey } from '../hooks/useApiKey';
import { useRides } from '../hooks/useStravaData';
import { readTokens } from '../lib/auth';
import { connectUrl } from '../lib/connectUrl';
import { MARCO } from '../lib/mockMarco';
import { fetchRwgpsStatus, disconnectRwgps } from '../lib/routesApi';
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
} from '../lib/validation';
import styles from './dashboard.you.module.css';

export const Route = createFileRoute('/dashboard/you')({
  component: YouTab,
});

interface ProfileResponse {
  name: string | null;
  dob: number | null;
  gender: string | null;
  gender_self: string | null;
  city: string | null;
  country: string | null;
  ftp: number | null;
  weight_kg: number | null;
  hr_max: number | null;
  passphrase_set_at: number | null;
}

const EMPTY_PROFILE: ProfileResponse = {
  name: null, dob: null, gender: null, gender_self: null,
  city: null, country: null, ftp: null, weight_kg: null, hr_max: null,
  passphrase_set_at: null,
};

function YouTab() {
  const tokens = readTokens();
  const isDemo = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1',
    [],
  );
  const usingMock = !tokens || isDemo;

  // Fetch the server-side profile (Sprint 13 / v11.2.0 source-of-truth).
  // Falls back to mock data when not authenticated.
  const [profile, setProfile] = useState<ProfileResponse>(EMPTY_PROFILE);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const refetchProfile = useCallback(async () => {
    if (usingMock) {
      setProfile({
        ...EMPTY_PROFILE,
        name: `${MARCO.firstName} ${MARCO.lastName}`,
        ftp: MARCO.ftp,
        weight_kg: MARCO.weight,
        hr_max: MARCO.hrMax,
      });
      setProfileLoaded(true);
      return;
    }
    try {
      const r = await fetch('/api/me/profile');
      if (r.ok) {
        const data = (await r.json()) as ProfileResponse;
        setProfile(data);
      }
    } catch {
      // network/auth error — leave profile in its previous state
    } finally {
      setProfileLoaded(true);
    }
  }, [usingMock]);

  useEffect(() => { refetchProfile(); }, [refetchProfile]);

  const { athlete } = useRides({ enabled: !usingMock, ftp: profile.ftp ?? 0 });
  const stravaConnected = !!tokens && !usingMock;

  const { key: apiKey, clear: clearApiKey } = useApiKey();

  // Sprint 13 / v11.1.0 — credentials substrate detection.
  // (Logic ported from the v11.1.0 wiring; same behavior.)
  const [credsChecked, setCredsChecked] = useState(false);
  const [hasEncryptedCreds, setHasEncryptedCreds] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const athleteId = athlete?.id ?? 0;

  useEffect(() => {
    if (usingMock) {
      setCredsChecked(true);
      return;
    }
    let cancelled = false;
    fetch('/api/me/credentials')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: Array<{ provider: string }> }) => {
        if (!cancelled) {
          setHasEncryptedCreds((data.items ?? []).length > 0);
          setCredsChecked(true);
        }
      })
      .catch(() => { if (!cancelled) setCredsChecked(true); });
    return () => { cancelled = true; };
  }, [usingMock]);

  const showMigrationBanner =
    credsChecked && !!apiKey && !hasEncryptedCreds && !!athleteId && !setupModalOpen;

  function handleMigrationComplete() {
    clearApiKey();
    setHasEncryptedCreds(true);
    setSetupModalOpen(false);
  }

  // RWGPS connection (carry over from prior implementation).
  const [rwgpsConnected, setRwgpsConnected] = useState<boolean | null>(null);
  const [rwgpsBusy, setRwgpsBusy] = useState(false);
  const [rwgpsError, setRwgpsError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokens || usingMock) {
      setRwgpsConnected(false);
      return;
    }
    let cancelled = false;
    fetchRwgpsStatus()
      .then((s) => { if (!cancelled) setRwgpsConnected(s.connected); })
      .catch(() => { if (!cancelled) setRwgpsConnected(false); });
    return () => { cancelled = true; };
  }, [tokens, usingMock]);

  async function handleRwgpsDisconnect() {
    if (rwgpsBusy) return;
    setRwgpsBusy(true);
    setRwgpsError(null);
    try {
      await disconnectRwgps();
      setRwgpsConnected(false);
    } catch (err) {
      setRwgpsError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setRwgpsBusy(false);
    }
  }

  return (
    <Container width="wide">
      <header className={styles.pageHead}>
        <h1 className={styles.h1}>You</h1>
      </header>

      {/* MIGRATION BANNER (Sprint 13 / v11.1.0) */}
      {showMigrationBanner && (
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
        >
          <MigrationBanner onMigrate={() => setSetupModalOpen(true)} />
        </motion.section>
      )}

      {setupModalOpen && (
        <SetupPassphraseModal
          athleteId={athleteId}
          initialAnthropicKey={apiKey ?? undefined}
          onComplete={handleMigrationComplete}
          onClose={() => setSetupModalOpen(false)}
        />
      )}

      {/* SECTION 01 — PERSONAL */}
      <PersonalSection
        profile={profile}
        loaded={profileLoaded}
        readOnly={usingMock}
        onSaved={refetchProfile}
      />

      {/* SECTION 02 — PERFORMANCE */}
      <PerformanceSection
        profile={profile}
        loaded={profileLoaded}
        readOnly={usingMock}
        onSaved={refetchProfile}
      />

      {/* SECTION 03 — AI COACH */}
      <AiCoachSection
        apiKey={apiKey}
        passphraseSetAt={profile.passphrase_set_at}
        onRemoveKey={() => {
          clearApiKey();
          setHasEncryptedCreds(false);
          refetchProfile();
        }}
      />

      {/* SECTION 04 — CONNECTIONS */}
      <motion.section
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
      >
        <Card tone="elev" pad="md">
          <Eyebrow rule tone="accent">№ 04 — Connections</Eyebrow>
          <div className={styles.connectionRow}>
            <div className={styles.connectionLabel}>
              <span className={styles.connectionName}>Strava</span>
              <span className={styles.connectionStatus}>
                {stravaConnected ? 'Connected · syncing rides automatically' : 'Not connected'}
              </span>
            </div>
            {stravaConnected ? null : (
              <Button variant="primary" size="sm" href={connectUrl()}>Connect</Button>
            )}
          </div>
          <div className={styles.connectionRow}>
            <div className={styles.connectionLabel}>
              <span className={styles.connectionName}>Ride with GPS</span>
              <span className={styles.connectionStatus}>
                {usingMock
                  ? 'Sign in to connect'
                  : rwgpsConnected === null
                    ? 'Checking connection…'
                    : rwgpsConnected
                      ? 'Connected · saved routes available in the picker'
                      : 'Not connected'}
              </span>
              {rwgpsError && <span className={styles.fieldError}>{rwgpsError}</span>}
            </div>
            {!usingMock && rwgpsConnected === true ? (
              <Button variant="ghost" size="sm" onClick={handleRwgpsDisconnect} disabled={rwgpsBusy}>
                {rwgpsBusy ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            ) : null}
            {!usingMock && rwgpsConnected === false ? (
              <Button variant="primary" size="sm" href="/authorize-rwgps">Connect</Button>
            ) : null}
          </div>
        </Card>
      </motion.section>

      {/* SECTION 05 — CONSENT & DATA (placeholder) */}
      <motion.section
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.25 }}
      >
        <Card tone="elev" pad="lg">
          <Eyebrow rule tone="accent">№ 05 — Consent &amp; Data</Eyebrow>
          <EmptyState
            tone="subtle"
            headline="Coming soon"
            body="Export your data, delete your account, and manage consent settings here."
            align="left"
          />
        </Card>
      </motion.section>
    </Container>
  );
}

// ============ SECTION 01 — PERSONAL ============

function PersonalSection({
  profile,
  loaded,
  readOnly,
  onSaved,
}: {
  profile: ProfileResponse;
  loaded: boolean;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    name: '', dob: '', gender: 'prefer-not-to-say', gender_self: '', city: '', country: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded) return;
    setDraft({
      name: profile.name ?? '',
      dob: profile.dob ? new Date(profile.dob * 1000).toISOString().slice(0, 10) : '',
      gender: profile.gender ?? 'prefer-not-to-say',
      gender_self: profile.gender_self ?? '',
      city: profile.city ?? '',
      country: profile.country ?? '',
    });
  }, [profile, loaded]);

  const handleSave = useCallback(async () => {
    if (readOnly) return;
    const next: Record<string, string> = {};
    const e1 = validateName(draft.name); if (e1) next.name = e1;
    if (draft.dob) {
      const dobEpoch = new Date(draft.dob + 'T00:00:00Z').getTime() / 1000;
      const e2 = validateDob(dobEpoch); if (e2) next.dob = e2;
    }
    const e3 = validateCity(draft.city); if (e3) next.city = e3;
    if (draft.country) {
      const e4 = validateCountry(draft.country.toUpperCase()); if (e4) next.country = e4;
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const body = {
        name: draft.name.trim() || null,
        dob: draft.dob ? new Date(draft.dob + 'T00:00:00Z').getTime() / 1000 : null,
        gender: draft.gender || null,
        gender_self: draft.gender === 'self-describe' ? (draft.gender_self.trim() || null) : null,
        city: draft.city.trim() || null,
        country: draft.country ? draft.country.toUpperCase() : null,
      };
      const r = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setSavedAt(Date.now());
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  }, [draft, onSaved, readOnly]);

  return (
    <motion.section
      className={styles.section}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card tone="elev" pad="md">
        <Eyebrow rule tone="accent">№ 01 — Personal</Eyebrow>
        <div className={styles.formGrid}>
          <Field label="Name">
            <input
              className={styles.input}
              value={draft.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: e.target.value })}
              maxLength={PROFILE_LIMITS.name.max}
              disabled={readOnly}
            />
            {errors.name && <FieldError>{errors.name}</FieldError>}
          </Field>
          <Field label="Date of birth">
            <input
              className={styles.input}
              type="date"
              value={draft.dob}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, dob: e.target.value })}
              disabled={readOnly}
            />
            {errors.dob && <FieldError>{errors.dob}</FieldError>}
          </Field>
          <Field label="Gender">
            <select
              className={styles.input}
              value={draft.gender}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setDraft({ ...draft, gender: e.target.value })}
              disabled={readOnly}
            >
              {PROFILE_GENDERS.map((g) => (
                <option key={g} value={g}>{g.replace(/-/g, ' ')}</option>
              ))}
            </select>
          </Field>
          {draft.gender === 'self-describe' && (
            <Field label="Self-describe">
              <input
                className={styles.input}
                value={draft.gender_self}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, gender_self: e.target.value })}
                maxLength={80}
                disabled={readOnly}
              />
            </Field>
          )}
          <Field label="City">
            <input
              className={styles.input}
              value={draft.city}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, city: e.target.value })}
              maxLength={PROFILE_LIMITS.city.max}
              disabled={readOnly}
            />
            {errors.city && <FieldError>{errors.city}</FieldError>}
          </Field>
          <Field label="Country">
            <input
              className={styles.input}
              value={draft.country}
              placeholder="CH"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, country: e.target.value.toUpperCase() })}
              maxLength={2}
              disabled={readOnly}
            />
            {errors.country && <FieldError>{errors.country}</FieldError>}
          </Field>
        </div>
        <div className={styles.actions}>
          {savedAt && <span className={styles.statusLine}>Saved.</span>}
          <Button variant="primary" loading={busy} onClick={handleSave} disabled={readOnly}>Save</Button>
        </div>
      </Card>
    </motion.section>
  );
}

// ============ SECTION 02 — PERFORMANCE ============

function PerformanceSection({
  profile,
  loaded,
  readOnly,
  onSaved,
}: {
  profile: ProfileResponse;
  loaded: boolean;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({ ftp: '', weight_kg: '', hr_max: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded) return;
    setDraft({
      ftp: profile.ftp != null ? String(profile.ftp) : '',
      weight_kg: profile.weight_kg != null ? String(profile.weight_kg) : '',
      hr_max: profile.hr_max != null ? String(profile.hr_max) : '',
    });
  }, [profile, loaded]);

  const handleSave = useCallback(async () => {
    if (readOnly) return;
    const next: Record<string, string> = {};
    const ftpN = Number(draft.ftp);
    const wN = Number(draft.weight_kg);
    const hrN = Number(draft.hr_max);
    const e1 = draft.ftp ? validateFtp(ftpN) : null; if (e1) next.ftp = e1;
    const e2 = draft.weight_kg ? validateWeightKg(wN) : null; if (e2) next.weight_kg = e2;
    const e3 = draft.hr_max ? validateHrMax(hrN) : null; if (e3) next.hr_max = e3;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ftp: draft.ftp ? ftpN : null,
          weight_kg: draft.weight_kg ? wN : null,
          hr_max: draft.hr_max ? hrN : null,
        }),
      });
      setSavedAt(Date.now());
      onSaved();
    } finally {
      setBusy(false);
    }
  }, [draft, onSaved, readOnly]);

  const wkg = profile.ftp && profile.weight_kg ? (profile.ftp / profile.weight_kg).toFixed(2) : null;

  return (
    <motion.section
      className={styles.section}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
    >
      <Card tone="elev" pad="md">
        <Eyebrow rule tone="accent">№ 02 — Performance</Eyebrow>
        <p className={styles.caption}>Used by PMC, plan generation, and zone math.{wkg ? ` Current W/kg: ${wkg}.` : ''}</p>
        <div className={styles.formGrid}>
          <Field label="FTP (W)">
            <input
              className={styles.input}
              type="number"
              min={PROFILE_LIMITS.ftp.min}
              max={PROFILE_LIMITS.ftp.max}
              value={draft.ftp}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, ftp: e.target.value })}
              disabled={readOnly}
            />
            {errors.ftp && <FieldError>{errors.ftp}</FieldError>}
          </Field>
          <Field label="Weight (kg)">
            <input
              className={styles.input}
              type="number"
              min={PROFILE_LIMITS.weight_kg.min}
              max={PROFILE_LIMITS.weight_kg.max}
              value={draft.weight_kg}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, weight_kg: e.target.value })}
              disabled={readOnly}
            />
            {errors.weight_kg && <FieldError>{errors.weight_kg}</FieldError>}
          </Field>
          <Field label="HR Max (bpm)">
            <input
              className={styles.input}
              type="number"
              min={PROFILE_LIMITS.hr_max.min}
              max={PROFILE_LIMITS.hr_max.max}
              value={draft.hr_max}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, hr_max: e.target.value })}
              disabled={readOnly}
            />
            {errors.hr_max && <FieldError>{errors.hr_max}</FieldError>}
          </Field>
        </div>
        <div className={styles.actions}>
          {savedAt && <span className={styles.statusLine}>Saved.</span>}
          <Button variant="primary" loading={busy} onClick={handleSave} disabled={readOnly}>Save</Button>
        </div>
      </Card>
    </motion.section>
  );
}

// ============ SECTION 03 — AI COACH ============

function AiCoachSection({
  apiKey,
  passphraseSetAt,
  onRemoveKey,
}: {
  apiKey: string | null;
  passphraseSetAt: number | null;
  onRemoveKey: () => void;
}) {
  return (
    <motion.section
      className={styles.section}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
    >
      <Card tone="elev" pad="md">
        <Eyebrow rule tone="accent">№ 03 — AI Coach (Anthropic)</Eyebrow>
        {passphraseSetAt ? (
          <>
            <p className={styles.statusLine}>encrypted on this device</p>
            <p className={styles.caption}>
              Your Anthropic key is locked with your password. Reload the page or
              switch devices to re-enter your password and unlock AI features.
            </p>
            <div className={styles.actions}>
              <a className={styles.recoveryLink} href="/account/recover">Forgot password?</a>
              <Button variant="destructive" onClick={onRemoveKey}>Remove key</Button>
            </div>
          </>
        ) : apiKey ? (
          <>
            <p className={styles.caption}>
              Key saved in this browser only. Use the migration banner above to lock
              it with a password so it works across devices.
            </p>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={onRemoveKey}>Remove key</Button>
            </div>
          </>
        ) : (
          <p className={styles.caption}>
            No Anthropic key saved. AI plan generation and per-ride coach feedback
            use your own Anthropic key —{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-default)', textDecoration: 'underline' }}
            >
              get a key →
            </a>
            . Open the AI Coach card on Today / Train to add one.
          </p>
        )}
      </Card>
    </motion.section>
  );
}

// ============ SHARED FIELD HELPERS ============

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className={styles.fieldLabel}>
      {label}{required ? <span className={styles.required}>*</span> : null}
      {children}
    </label>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return <p className={styles.fieldError}>{children}</p>;
}
