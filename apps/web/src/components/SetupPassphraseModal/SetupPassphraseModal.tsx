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
      const setupRes = await fetch('/api/me/passphrase/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recovery_code_hash: recoveryHash,
          passphrase_set_at: Math.floor(Date.now() / 1000),
        }),
      });
      if (!setupRes.ok) throw new Error('setup_failed');

      const credRes = await fetch('/api/me/credentials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
        'Cadence Club — recovery code\n\n',
        `${recoveryCode}\n\n`,
        `Generated: ${new Date().toISOString()}\n`,
        'Use at: https://cycling-coach.josem-reboredo.workers.dev/account/recover\n',
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cadence-club-recovery-code.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [recoveryCode]);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        {step === 1 && (
          <>
            <Eyebrow rule tone="accent">Step 1 of 3</Eyebrow>
            <h2 className={styles.h2}>Set your passphrase</h2>
            <p className={styles.lede}>
              Your Anthropic key needs a passphrase. We use it to encrypt the
              key on your device — neither Cadence Club nor Cloudflare can
              read it. Forget the passphrase, lose the key (recovery code on
              the next step).
            </p>
            <label className={styles.fieldLabel}>
              Passphrase <span className={styles.required}>*</span>
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
              Confirm passphrase <span className={styles.required}>*</span>
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
            <h2 className={styles.h2}>Save your recovery code</h2>
            <p className={styles.lede}>
              Write this down. We can't recover it for you. This code resets
              your passphrase on a lost device — without it, you re-enter
              your Anthropic key from scratch.
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
                Encrypt my key
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Eyebrow rule tone="accent">Step 3 of 3</Eyebrow>
            <h2 className={styles.h2}>Encrypted</h2>
            <p className={styles.lede}>
              Your key is on your device, encrypted with your passphrase.
              Re-enter on each new device or use the recovery code.
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
