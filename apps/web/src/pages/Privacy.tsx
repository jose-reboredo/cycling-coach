import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { TopBar } from '../components/TopBar/TopBar';
import { Button } from '../components/Button/Button';
import { Pill } from '../components/Pill/Pill';
import { Link } from '@tanstack/react-router';
import styles from './Privacy.module.css';

export function Privacy() {
  return (
    <div className={styles.page}>
      <TopBar
        trailing={
          <Link to="/dashboard" className={styles.navLink}>Dashboard</Link>
        }
      />
      <main>
        <Container width="narrow">
          <header className={styles.head}>
            <Eyebrow rule tone="accent">№ — The fine print</Eyebrow>
            <h1 className={styles.h1}>
              Privacy &amp; <em>data handling</em>
            </h1>
            <p className={styles.lede}>
              A short, honest account of what happens to your data — written like the
              contract a friend would sign with you.
            </p>
          </header>

          <article className={styles.body}>
            <Section num="01" title="The short version">
              <p>
                Cadence Club is a small product run by a single maintainer. There's no marketing email list,
                no third-party analytics, no ads. Your Strava data lives in
                <strong> your browser's localStorage</strong> — and, optionally, in our D1
                database keyed by your Strava athlete ID.
              </p>

              <Box tone="success" title="What stays on your device" labelTone="success">
                <ul>
                  <li>Strava access &amp; refresh tokens</li>
                  <li>Cached athlete profile + activities</li>
                  <li>Yearly goal target + event date</li>
                  <li>AI coaching reports (cached locally)</li>
                  <li>Your Anthropic API key (if you've added one)</li>
                </ul>
              </Box>

              <Box tone="warn" title="What briefly passes through the worker" labelTone="warn">
                <ul>
                  <li><strong>OAuth code</strong> — exchanged for tokens, then discarded.</li>
                  <li><strong>API requests</strong> — proxied to Strava (CORS), forwarded, not stored as logs.</li>
                  <li><strong>Refresh requests</strong> — same pattern.</li>
                  <li><strong>AI coaching</strong> — stats sent to Anthropic Claude with your key.</li>
                </ul>
              </Box>
            </Section>

            <Section num="02" title="Cloudflare">
              <p>
                Workers run on Cloudflare's edge. Standard infrastructure logs (request count,
                error rates, regions) apply — aggregate metrics, not user-level data.
              </p>
            </Section>

            <Section num="03" title="Anthropic — bring your own key">
              <p>
                AI coaching is BYOK. Sign up at Anthropic, add credits, paste your key.
                It's stored only in your browser. When you tap <strong>Generate</strong>, your
                stats and key are forwarded to Claude. We don't store your key or your reports —
                Anthropic's <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a> applies on their side.
              </p>
              <p>
                Each user pays for their own AI usage (~$0.02 per report). Skip AI coaching
                entirely if you don't want to bother — every other feature works without it.
              </p>
            </Section>

            <Section num="04" title="Strava">
              <p>
                Strava sees that you authorized this app, your activity data being pulled, and
                the API call patterns — standard for any Strava-connected app. Revoke anytime at{' '}
                <code>strava.com/settings/apps</code>.
              </p>
            </Section>

            <Section num="05" title="Deletion">
              <p>
                Clear your browser → tokens, cached rides, AI reports, and goals are deleted.
                Reconnect to Strava — same one-click flow.
              </p>
              <ul>
                <li><strong>Disconnect button</strong> on the dashboard — clears local data instantly.</li>
                <li><strong>Revoke at Strava</strong> — go to <code>strava.com/settings/apps</code>.</li>
              </ul>
            </Section>

            <Button href="/" variant="secondary" size="md" withArrow={false}>
              ← Back to home
            </Button>
          </article>

          <footer className={styles.foot}>
            <Pill>Built for cycling friends</Pill>
            <span>Powered by Cloudflare · Strava · Anthropic</span>
          </footer>
        </Container>
      </main>
    </div>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <Eyebrow rule>№ {num} — {title}</Eyebrow>
      <h2 className={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

function Box({
  tone, title, labelTone, children,
}: { tone: 'success' | 'warn'; title: string; labelTone: 'success' | 'warn'; children: React.ReactNode }) {
  return (
    <div className={`${styles.box} ${styles[`box-${tone}`]}`}>
      <header className={styles.boxHead}>
        <h3 className={styles.boxTitle}>{title}</h3>
        <Pill tone={labelTone}>{labelTone === 'success' ? 'Local' : 'Transit'}</Pill>
      </header>
      {children}
    </div>
  );
}
