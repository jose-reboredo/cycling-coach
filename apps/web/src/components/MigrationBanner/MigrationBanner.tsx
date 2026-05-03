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
      <Eyebrow rule tone="accent">One-time migration</Eyebrow>
      <p className={styles.lede}>
        Your Anthropic key currently lives in browser storage. Move it to
        encrypted storage so it persists across devices, encrypted with a
        passphrase only you know.
      </p>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onMigrate}>Set up encryption</Button>
      </div>
    </Card>
  );
}
