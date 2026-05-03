// apps/web/src/routes/account.recover.tsx
//
// Sprint 13 / v11.1.0 — recovery flow.
// Enter recovery code → server hashes + matches users.recovery_code_hash →
// on match: server clears hash + nukes user_credentials.ciphertext rows;
// user sets a new passphrase via the AI Coach card on next visit.
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { Container } from '../components/Container/Container';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { hashRecoveryCode } from '../lib/credentials';

export const Route = createFileRoute('/account/recover')({
  component: AccountRecover,
});

function AccountRecover() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'enter-code' | 'success'>('enter-code');

  const handleRecover = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const recoveryHash = await hashRecoveryCode(code.trim().toUpperCase());
      const res = await fetch('/api/me/passphrase/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recovery_code_hash: recoveryHash }),
      });
      if (!res.ok) {
        setError('Recovery code did not match. Check the code and try again.');
        return;
      }
      setStage('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recovery failed.');
    } finally {
      setBusy(false);
    }
  }, [code]);

  return (
    <Container width="narrow">
      <header style={{ padding: 'var(--space-12) 0 var(--space-6)' }}>
        <Eyebrow rule tone="accent">Recovery</Eyebrow>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--font-size-3xl)',
          lineHeight: 1.05,
          fontWeight: 600,
          margin: 0,
        }}>
          Lost your passphrase?
        </h1>
      </header>
      {stage === 'enter-code' && (
        <Card tone="elev" pad="lg">
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Enter your recovery code. We'll clear the encrypted key on the
            server (it's unrecoverable without the old passphrase anyway).
            Set a new passphrase next, then re-enter your Anthropic key to
            encrypt against the new master key.
          </p>
          <input
            type="text"
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              appearance: 'none',
              width: '100%',
              height: 'var(--hit-min)',
              padding: '0 var(--space-3)',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-md)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          />
          {error && (
            <p style={{ color: 'var(--state-danger)', marginTop: 'var(--space-2)' }}>
              {error}
            </p>
          )}
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              loading={busy}
              disabled={code.trim().length < 24 || busy}
              onClick={handleRecover}
            >
              Recover
            </Button>
          </div>
        </Card>
      )}
      {stage === 'success' && (
        <Card tone="elev" pad="lg">
          <Eyebrow rule tone="accent">Cleared</Eyebrow>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-size-2xl)',
            margin: 0,
            fontWeight: 600,
          }}>
            Recovery successful.
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Your encrypted keys have been cleared. Visit your account to set
            a new passphrase and re-enter your Anthropic key.
          </p>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button variant="primary" onClick={() => navigate({ to: '/dashboard/you' })}>
              Back to account
            </Button>
          </div>
        </Card>
      )}
    </Container>
  );
}
