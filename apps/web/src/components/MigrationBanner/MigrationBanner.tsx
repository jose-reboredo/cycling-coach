// apps/web/src/components/MigrationBanner/MigrationBanner.tsx
//
// Sprint 13 / v11.1.0 — one-time banner for users who already have an
// Anthropic key in browser localStorage. Shown on the AI Coach card
// when localStorage.anthropicKey is present AND passphrase_set_at is null.
import { Card } from '../Card/Card';
import { Button } from '../Button/Button';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import styles from './MigrationBanner.module.css';

interface Props {
  onMigrate: () => void;
}

export function MigrationBanner({ onMigrate }: Props) {
  return (
    <Card tone="accent" pad="md">
      <Eyebrow rule tone="accent">One-time setup</Eyebrow>
      <p className={styles.lede}>
        Your Anthropic key is saved in this browser only. Lock it with a
        password so it works across your devices — only you will know the
        password.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onMigrate}>Add a password</Button>
      </div>
    </Card>
  );
}
