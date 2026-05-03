// apps/web/src/components/SetupPassphraseModal/SetupPassphraseModal.tsx
//
// Sprint 13 / v11.1.0 — first-time passphrase setup modal.
// 3 steps: passphrase + key → recovery code → confirmation.
import { useCallback, useState } from 'react';
import { Button } from '../Button/Button';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import {
  generateRecoveryCode,
  hashRecoveryCode,
  buildAAD,
  encryptKey,
  deriveMasterKey,
} from '../../lib/credentials';
import { usePassphrase } from '../../hooks/usePassphrase';
import { ensureValidToken } from '../../lib/auth';
import styles from './SetupPassphraseModal.module.css';

interface Props {
  athleteId: number;
  /** Pre-fill the Anthropic key field — used by the migration banner
   *  flow to carry the existing localStorage key into the modal. */
  initialAnthropicKey?: string;
  /** Called after the modal completes successfully. */
  onComplete: (plaintextAnthropicKey: string) => void;
  onClose: () => void;
}

const KDF_ITERATIONS = 600000;

export function SetupPassphraseModal({
  athleteId,
  initialAnthropicKey,
  onComplete,
  onClose,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [anthropicKey, setAnthropicKey] = useState(initialAnthropicKey ?? '');
  const [recoveryCode] = useState(() => generateRecoveryCode());
  const [savedCheck, setSavedCheck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { unlock } = usePassphrase();

  const step1Valid =
    passphrase.length >= 8 &&
    passphrase === confirm &&
    anthropicKey.startsWith('sk-ant-');

  const handleEncryptAndSave = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const masterKey = await deriveMasterKey(passphrase, salt, KDF_ITERATIONS);
      const aad = buildAAD(athleteId, 'anthropic');
      const { ciphertext, iv } = await encryptKey(masterKey, anthropicKey, aad);
      const recoveryHash = await hashRecoveryCode(recoveryCode);

      // Persist passphrase metadata + the first ciphertext.
      // Sprint 14 / v11.5.0 — Authorization header required by the worker's
      // resolveAthleteId(). Without it the endpoints return 401.
      const t = await ensureValidToken();
      if (!t) throw new Error('not_authenticated');
      const authHeader = { Authorization: `Bearer ${t.access_token}` };

      const setupRes = await fetch('/api/me/passphrase/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          recovery_code_hash: recoveryHash,
          passphrase_set_at: Math.floor(Date.now() / 1000),
        }),
      });
      if (!setupRes.ok) throw new Error('setup_failed');

      const credRes = await fetch('/api/me/credentials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          provider: 'anthropic',
          ciphertext: bufToB64(ciphertext),
          iv: bufToB64(iv),
          kdf_salt: bufToB64(salt),
          kdf_iterations: KDF_ITERATIONS,
        }),
      });
      if (!credRes.ok) throw new Error('save_failed');

      // Unlock the session so subsequent encrypt/decrypt calls work
      // without re-prompting until reload.
      await unlock(passphrase, salt, KDF_ITERATIONS);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Encryption failed.');
    } finally {
      setBusy(false);
    }
  }, [passphrase, anthropicKey, recoveryCode, athleteId, unlock]);

  const downloadRecovery = useCallback(() => {
    const blob = new Blob(
      [
        'Cadence Club — backup code\n\n',
        `${recoveryCode}\n\n`,
        `Generated: ${new Date().toISOString()}\n`,
        'Use at: https://cycling-coach.josem-reboredo.workers.dev/account/recover\n',
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cadence-club-backup-code.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [recoveryCode]);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        {step === 1 && (
          <>
            <Eyebrow rule tone="accent">Step 1 of 3</Eyebrow>
            <h2 className={styles.h2}>Set a password to lock your AI key</h2>
            <p className={styles.lede}>
              Pick a password — only you will know it. We use it to lock your
              Anthropic key on this device. Nobody at Cadence Club or
              Cloudflare can see your key, ever. Forget the password and you
              lose the key (we'll give you a backup code on the next screen).
            </p>
            <label className={styles.fieldLabel}>
              Password <span className={styles.required}>*</span>
              <input
                className={styles.input}
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
                minLength={8}
              />
            </label>
            <label className={styles.fieldLabel}>
              Confirm password <span className={styles.required}>*</span>
              <input
                className={styles.input}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              Anthropic key <span className={styles.required}>*</span>
              <input
                className={styles.input}
                type="password"
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
              />
            </label>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Eyebrow rule tone="accent">Step 2 of 3</Eyebrow>
            <h2 className={styles.h2}>Save your backup code</h2>
            <p className={styles.lede}>
              Write this down. If you forget your password, this code lets you
              start fresh. Without it, you'd have to enter your Anthropic key
              from scratch.
            </p>
            <pre className={styles.recoveryCode}>{recoveryCode}</pre>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={downloadRecovery}>Download as .txt</Button>
              <Button
                variant="ghost"
                onClick={() => navigator.clipboard.writeText(recoveryCode)}
              >
                Copy to clipboard
              </Button>
            </div>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={savedCheck}
                onChange={(e) => setSavedCheck(e.target.checked)}
              />
              I've saved it somewhere safe.
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button
                variant="primary"
                disabled={!savedCheck || busy}
                loading={busy}
                onClick={handleEncryptAndSave}
              >
                Lock my key
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Eyebrow rule tone="accent">Step 3 of 3</Eyebrow>
            <h2 className={styles.h2}>Locked. You're set.</h2>
            <p className={styles.lede}>
              Your Anthropic key is locked on this device. On a new device,
              just enter your password again — or use your backup code if you
              forget it.
            </p>
            <div className={styles.actions}>
              <Button
                variant="primary"
                onClick={() => onComplete(anthropicKey)}
              >
                Back to AI Coach
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
