/**
 * Sprint 12 — `/design-system` showcase route.
 *
 * Lightweight in-product equivalent of Storybook. Renders every
 * rebuilt component in every state at desktop and 375px mobile
 * viewports side-by-side. The Brand Designer + Founder walk this
 * page asynchronously to verify the kit without booting Figma.
 *
 * Dev-only by intent: the route is reachable in production (no
 * gating) but not linked from any nav. Adding to robots.txt /
 * sitemap is a future concern.
 */
import { createFileRoute } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Toast } from '../components/Toast/Toast';
import styles from './design-system.module.css';

export const Route = createFileRoute('/design-system')({
  component: DesignSystem,
});

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <Eyebrow rule tone="accent">{eyebrow}</Eyebrow>
        <h2 className={styles.sectionH2}>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function StateRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.stateRow}>
      <span className={styles.stateLabel}>{label}</span>
      <div className={styles.stateExamples}>{children}</div>
    </div>
  );
}

function DesignSystem() {
  return (
    <div className={styles.page}>
      <Container width="wide">
        <header className={styles.pageHead}>
          <Eyebrow rule tone="accent">Design system · v11.0.0</Eyebrow>
          <h1 className={styles.pageH1}>The kit</h1>
          <p className={styles.pageLede}>
            Every rebuilt component, every state. Token-only styling. Use this
            page as the canonical reference when scaling patterns to in-app
            surfaces in Sprint 14+.
          </p>
        </header>

        {/* ============ TOKENS ============ */}
        <Section title="Tokens" eyebrow="№ 01 — Foundations">
          <div className={styles.swatchGrid}>
            <Swatch token="--surface-page" />
            <Swatch token="--surface-card" />
            <Swatch token="--surface-elevated" />
            <Swatch token="--accent-default" />
            <Swatch token="--accent-hover" />
            <Swatch token="--accent-pressed" />
            <Swatch token="--text-primary" />
            <Swatch token="--text-secondary" />
            <Swatch token="--border-default" />
            <Swatch token="--state-success" />
            <Swatch token="--state-warning" />
            <Swatch token="--state-danger" />
          </div>

          <h3 className={styles.subhead}>Type pairing</h3>
          <div className={styles.typeStack}>
            <p className={styles.typeDisplay}>Display · Source Serif Pro</p>
            <p className={styles.typeH2}>Section H2 · Source Serif Pro</p>
            <p className={styles.typeBody}>Body — Geist sans, the workhorse for prose and UI.</p>
            <p className={styles.typeMono}>Mono · Geist Mono · 12345 ·  for instruments</p>
          </div>
        </Section>

        {/* ============ BUTTON ============ */}
        <Section title="Button" eyebrow="№ 02 — Action">
          <StateRow label="Primary · sm / md / lg">
            <Button size="sm">Connect</Button>
            <Button size="md">Connect with Strava</Button>
            <Button size="lg">Connect with Strava</Button>
          </StateRow>
          <StateRow label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="strava">Strava</Button>
          </StateRow>
          <StateRow label="States — Primary">
            <Button>Default</Button>
            <Button className={styles.forceHover}>Hover</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
            <Button withArrow>With arrow (jump-link only)</Button>
          </StateRow>
          <StateRow label="Full width">
            <Button fullWidth>Full width primary</Button>
          </StateRow>
        </Section>

        {/* ============ CARD ============ */}
        <Section title="Card" eyebrow="№ 03 — Surface">
          <div className={styles.cardGrid}>
            <Card tone="base" pad="md">
              <Eyebrow>Tone · base</Eyebrow>
              <p>Default surface. Border, no shadow. Single depth strategy.</p>
            </Card>
            <Card tone="elev" pad="md">
              <Eyebrow>Tone · elev</Eyebrow>
              <p>Elevated surface. Used for modals, drawers.</p>
            </Card>
            <Card tone="pressed" pad="md">
              <Eyebrow>Tone · pressed</Eyebrow>
              <p>Pressed-state background.</p>
            </Card>
            <Card tone="accent" pad="md">
              <Eyebrow tone="accent">Tone · accent</Eyebrow>
              <p>Molten-orange glow. Border transparent (single depth — shadow only).</p>
            </Card>
            <Card tone="base" pad="md" rule>
              <Eyebrow tone="accent">Rule</Eyebrow>
              <p>Vertical accent bar on the left edge.</p>
            </Card>
            <Card tone="base" pad="md" interactive onClick={() => {}}>
              <Eyebrow tone="accent">Interactive</Eyebrow>
              <p>Click-or-keyboard activatable. Hover lift, focus-ring.</p>
            </Card>
          </div>
        </Section>

        {/* ============ EMPTY STATE ============ */}
        <Section title="Empty state" eyebrow="№ 04 — Honest gaps">
          <div className={styles.emptyGrid}>
            <Card tone="base" pad="lg">
              <EmptyState
                tone="default"
                headline="No form data yet"
                body="Connect Strava and we'll compute the curve from your last 90 days."
                cta={<Button variant="primary">Connect with Strava</Button>}
              />
            </Card>
            <Card tone="base" pad="lg">
              <EmptyState
                tone="subtle"
                headline="No saved routes in Zürich"
                body="Either no routes match your filter, or your Strava save list is empty in this region."
                align="left"
              />
            </Card>
          </div>
        </Section>

        {/* ============ SKELETON ============ */}
        <Section title="Skeleton" eyebrow="№ 05 — Loading">
          <Card tone="base" pad="lg">
            <div className={styles.skelStack}>
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" lines={3} />
              <div className={styles.skelInline}>
                <Skeleton variant="circle" />
                <Skeleton variant="rect" width={120} height={28} />
              </div>
              <Skeleton variant="card" />
            </div>
          </Card>
        </Section>

        {/* ============ TOAST ============ */}
        <Section title="Toast" eyebrow="№ 06 — Notification">
          <div className={styles.toastStack}>
            <Toast variant="success" title="Saved." body="Tuesday's session is on your calendar at 18:00." onDismiss={() => {}} />
            <Toast variant="info" title="Plan regenerated." body="Your weekly plan picked up Saturday's ride." />
            <Toast variant="warning" title="Strava connection expires in 2 days." body="Reconnect to keep syncing." />
            <Toast variant="danger" title="Strava connection expired." body="Reconnect to keep syncing." onDismiss={() => {}} action={<Button variant="link" size="sm">Reconnect</Button>} />
          </div>
        </Section>

        {/* ============ MOBILE PARALLEL ============ */}
        <Section title="Mobile (375px)" eyebrow="№ 07 — Mobile parity">
          <div className={styles.mobileFrame} aria-label="375px mobile viewport simulation">
            <div className={styles.mobileFrameInner}>
              <Button fullWidth>Connect with Strava</Button>
              <Card tone="elev" pad="md">
                <Eyebrow>Today's session</Eyebrow>
                <p>Sweet-spot intervals · 3×12</p>
              </Card>
              <Toast variant="info" title="Plan regenerated." body="Your weekly plan picked up Saturday's ride." />
              <EmptyState
                tone="default"
                headline="No form data yet"
                body="Connect Strava to compute your curve."
                cta={<Button variant="primary" fullWidth>Connect Strava</Button>}
              />
            </div>
          </div>
        </Section>
      </Container>
    </div>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div className={styles.swatch}>
      <div className={styles.swatchSwatch} style={{ background: `var(${token})` }} />
      <code className={styles.swatchToken}>{token}</code>
    </div>
  );
}
