// apps/web/src/components/PassphraseUnlockCard/PassphraseUnlockCard.tsx
//
// Sprint 13 / v11.1.0 — per-session passphrase unlock surface.
// Shown on the AI Coach card when the user has a passphrase set but
// hasn't unlocked this browser session yet.
import { useCallback, useState } from 'react';
import { Card } from '../Card/Card';
import { Button } from '../Button/Button';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { usePassphrase } from '../../hooks/usePassphrase';
import styles from './PassphraseUnlockCard.module.css';

interface Props {
  /** From GET /api/me/credentials → row's salt + iter for the user. */
  saltB64: string;
  iterations: number;
  onUnlocked: () => void;
}

export function PassphraseUnlockCard({ saltB64, iterations, onUnlocked }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { unlock } = usePassphrase();

  const handleUnlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const salt = b64ToBuf(saltB64);
      await unlock(passphrase, salt, iterations);
      onUnlocked();
    } catch {
      setError("That passphrase doesn't match. Try again or use your recovery code.");
    } finally {
      setBusy(false);
    }
  }, [passphrase, saltB64, iterations, unlock, onUnlocked]);

  return (
    <Card tone="elev" pad="md">
      <Eyebrow rule tone="accent">AI Coach · locked</Eyebrow>
      <p className={styles.lede}>
        Enter your passphrase to use AI features in this session.
      </p>
      <input
        className={styles.input}
        type="password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
        autoFocus
        placeholder="passphrase"
      />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <a className={styles.recoveryLink} href="/account/recover">Forgot passphrase?</a>
        <Button
          variant="primary"
          disabled={passphrase.length < 1 || busy}
          loading={busy}
          onClick={handleUnlock}
        >
          Unlock
        </Button>
      </div>
    </Card>
  );
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
