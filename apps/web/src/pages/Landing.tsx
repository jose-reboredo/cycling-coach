import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Button } from '../components/Button/Button';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Pill } from '../components/Pill/Pill';
import { BikeMark } from '../components/BikeMark/BikeMark';
import { GrainOverlay } from '../components/GrainOverlay/GrainOverlay';
import { ZonePill } from '../components/ZonePill/ZonePill';
import { PmcStrip } from '../components/PmcStrip/PmcStrip';
import { ProgressRing } from '../components/ProgressRing/ProgressRing';
import { TopBar } from '../components/TopBar/TopBar';
import { Link } from '@tanstack/react-router';
import { connectUrl } from '../lib/connectUrl';
import styles from './Landing.module.css';

const fade = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] },
};

export function Landing() {
  return (
    <div className={styles.page}>
      <TopBar
        trailing={
          <>
            <Link to="/privacy" className={styles.navLink}>Privacy</Link>
            <Button href={connectUrl()} size="sm" variant="primary" withArrow>
              Connect
            </Button>
          </>
        }
      />

      {/* HERO */}
      <section className={styles.hero}>
        <ClimbProfile />
        <GrainOverlay intensity={0.18} />

        <Container width="base">
          <motion.div className={styles.heroInner} {...fade}>
            <Pill tone="accent" dot>
              For the performance-driven amateur · v8
            </Pill>

            <h1 className={styles.heroH1}>
              Train like the
              <span className={styles.heroH1Italic}> metrics </span>
              matter.
            </h1>

            <p className={styles.heroLede}>
              PMC, structured workouts, smart route picker — built for cyclists who
              already know their FTP. Strava-native. Local-first. Bring your own AI key.
            </p>

            <div className={styles.heroCtas}>
              <Button href={connectUrl()} size="lg" variant="primary" withArrow>
                Connect with Strava
              </Button>
              <Button href="#what" size="lg" variant="ghost">
                See what you get
              </Button>
            </div>

            <ul className={styles.heroFacts}>
              <li><span className={styles.heroFactNum}>10s</span><span>setup</span></li>
              <li><span className={styles.heroFactNum}>$0</span><span>monthly · BYOK</span></li>
              <li><span className={styles.heroFactNum}>∞</span><span>token refresh</span></li>
              <li><span className={styles.heroFactNum}>100%</span><span>local-first</span></li>
            </ul>
          </motion.div>

          {/* Instrument-cluster preview */}
          <motion.div
            className={styles.heroPreview}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], delay: 0.25 }}
          >
            <div className={styles.previewHead}>
              <Eyebrow rule>Today · 04:42 · Zürich</Eyebrow>
              <Pill dot tone="success">Live</Pill>
            </div>
            <PmcStrip ctl={78} atl={82} tsb={-4} ctlDelta={2.4} atlDelta={-1.1} tsbDelta={3.5} />
            <div className={styles.previewBody}>
              <div className={styles.previewMain}>
                <Eyebrow>Today's workout</Eyebrow>
                <h3 className={styles.previewTitle}>Sweet-spot intervals · 3×12</h3>
                <div className={styles.previewZones}>
                  <ZonePill zone={1} size="sm" label="Z1 · 10m" />
                  <ZonePill zone={4} size="sm" label="Z4 · 36m" />
                  <ZonePill zone={1} size="sm" label="Z1 · 14m" />
                </div>
                <p className={styles.previewMeta}>
                  <span>1h 15m</span><span>·</span><span>78 TSS</span><span>·</span><span>252 W avg</span>
                </p>
              </div>
              <div className={styles.previewSide}>
                <ProgressRing
                  value={0.603}
                  size={140}
                  thickness={10}
                  eyebrow="2026"
                  label="of 8,000 km"
                >
                  <span className={styles.ringNum}>4,823</span>
                </ProgressRing>
              </div>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* CREDENTIALS BAND */}
      <section className={styles.band} aria-label="Credentials">
        <Container width="base">
          <ul className={styles.bandList}>
            <li>
              <span className={styles.bandNum}>6</span>
              <span className={styles.bandLabel}>Coggan zones</span>
            </li>
            <li>
              <span className={styles.bandNum}>$0</span>
              <span className={styles.bandLabel}>Subscription</span>
            </li>
            <li>
              <span className={styles.bandNum}>100%</span>
              <span className={styles.bandLabel}>Your data, your machine</span>
            </li>
            <li>
              <span className={styles.bandNum}>&lt;10s</span>
              <span className={styles.bandLabel}>Connect to dashboard</span>
            </li>
          </ul>
        </Container>
      </section>

      {/* FOR YOU / NOT FOR YOU */}
      <section className={styles.for}>
        <Container width="base">
          <div className={styles.sectionHead}>
            <Eyebrow rule tone="accent">№ 01 — Honesty</Eyebrow>
            <h2 className={styles.sectionH2}>
              For cyclists who care
              <em> about the numbers</em>.
            </h2>
            <p className={styles.sectionLede}>
              We're brutally specific about who this is for. If you don't recognise yourself
              on the left, you'll save 30 seconds and we'll save you a download.
            </p>
          </div>
          <div className={styles.forGrid}>
            <ForList variant="for" title="For you if…" items={[
              'You already know your FTP and care about W/kg',
              'You train 6+ hours a week with a power meter or smart trainer',
              'You have a goal event you\'re peaking for',
              'You want PMC, not "calories burned"',
              'You read your data the morning after, before the kettle',
              'You think Strava\'s feed is for kudos, not training',
            ]} />
            <ForList variant="not" title="Not for you if…" items={[
              'You just want to log rides for kudos',
              'You don\'t care what your CTL is',
              'You want gamification, badges, leaderboards',
              'You\'re looking for a casual fitness app',
              'You want to be told you "crushed it" every day',
              'A monthly subscription is the value proposition',
            ]} />
          </div>
        </Container>
      </section>

      {/* WHAT YOU GET */}
      <section className={styles.features} id="what">
        <Container width="base">
          <div className={styles.sectionHead}>
            <Eyebrow rule tone="accent">№ 02 — The product</Eyebrow>
            <h2 className={styles.sectionH2}>
              Three screens.
              <em> One coherent training brain</em>.
            </h2>
          </div>

          <FeatureSpread
            num="01"
            title="Live training status"
            kicker="Form, fitness, fatigue — at-a-glance"
            body="Your CTL, ATL and TSB, computed nightly from every ride that has power data. The first thing you see, every morning. Not buried four taps deep."
            visual={<PmcStrip ctl={78} atl={82} tsb={-4} ctlDelta={2.4} atlDelta={-1.1} tsbDelta={3.5} />}
          />

          <FeatureSpread
            num="02"
            title="Today's workout, in your pocket"
            kicker="One tap to start. Zones, target watts, rationale."
            body="The plan adapts to your form. Hard day after a fresh score. Easy day after a slammed score. The coach voice tells you why, then gets out of the way."
            visual={<WorkoutPreview />}
            reverse
          />

          <FeatureSpread
            num="03"
            title="Routes that match the plan"
            kicker="Saved Strava routes, ranked by today's target."
            body="Picking the right route is half the workout. Cycling Coach reads your saved Strava routes, scores them against today's target zone and duration, and surfaces the top three."
            visual={<RoutePreview />}
          />
        </Container>
      </section>

      {/* PRICING — honest BYOK */}
      <section className={styles.pricing}>
        <Container width="base">
          <div className={styles.sectionHead}>
            <Eyebrow rule tone="accent">№ 03 — Pricing</Eyebrow>
            <h2 className={styles.sectionH2}>
              Free. <em>Forever.</em><br/>
              Bring your own key.
            </h2>
            <p className={styles.sectionLede}>
              Cycling Coach itself costs nothing. AI coaching uses your own Anthropic
              API key — about $0.02 per report. Most users spend less than $0.50 a month total.
            </p>
          </div>
          <div className={styles.priceGrid}>
            <PriceRow label="App" price="Free" detail="No subscription. No tier upgrades. No login wall." />
            <PriceRow label="Strava data" price="Free" detail="Their API. We just proxy it. Your tokens stay in your browser." />
            <PriceRow label="AI coaching" price="≈ $0.02" detail="Per report. Anthropic Claude. Your key, your bill." />
            <PriceRow label="Estimated total" price="< $0.50/mo" detail="For most riders. Skip AI and it's $0." emphasis />
          </div>
        </Container>
      </section>

      {/* FINAL CTA */}
      <section className={styles.final}>
        <ClimbProfile dense />
        <GrainOverlay intensity={0.22} />
        <Container width="narrow">
          <motion.div
            className={styles.finalInner}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          >
            <Eyebrow rule tone="accent">Ready</Eyebrow>
            <h2 className={styles.finalH2}>
              Don't break <em>the chain</em>.
            </h2>
            <p className={styles.finalLede}>
              One click. Full Strava history imported. PMC, plan, route picker —
              all yours, all local, all free.
            </p>
            <Button href={connectUrl()} size="lg" variant="primary" withArrow>
              Connect with Strava
            </Button>
            <p className={styles.finalNote}>
              No credit card. No email signup. Strava OAuth.
            </p>
          </motion.div>
        </Container>
      </section>

      {/* FOOTER */}
      <footer className={styles.foot}>
        <Container width="base">
          <div className={styles.footTop}>
            <div className={styles.footBrand}>
              <BikeMark size={28} />
              <div>
                <p className={styles.footName}>Cycling Coach</p>
                <p className={styles.footTag}>
                  A performance training brain. Built quietly,<br/>
                  for cycling friends, with no investors.
                </p>
              </div>
            </div>
            <div className={styles.footCols}>
              <FootCol title="Product" links={[
                { href: '/dashboard', label: 'Dashboard' },
                { href: connectUrl(), label: 'Connect Strava' },
                { href: '#what', label: 'What you get' },
                { href: '/whats-next', label: "What's next" },
              ]} />
              <FootCol title="Trust" links={[
                { href: '/privacy', label: 'Privacy' },
                { href: 'https://www.strava.com/settings/apps', label: 'Revoke access', external: true },
              ]} />
              <FootCol title="Powered by" links={[
                { href: 'https://www.strava.com', label: 'Strava API', external: true },
                { href: 'https://www.anthropic.com', label: 'Anthropic Claude', external: true },
                { href: 'https://workers.cloudflare.com', label: 'Cloudflare Workers', external: true },
              ]} />
            </div>
          </div>
          <div className={styles.footBottom}>
            <span className={styles.footVer}>v8.4.1 · April 2026</span>
            <span className={styles.footRights}>© Cycling Coach · Strava® is a registered trademark of Strava, Inc.</span>
          </div>
        </Container>
      </footer>
    </div>
  );
}

/* ----- subcomponents (page-local) ----- */

function ForList({ variant, title, items }: { variant: 'for' | 'not'; title: string; items: string[] }) {
  return (
    <div className={`${styles.forCol} ${styles[`forCol-${variant}`]}`}>
      <Eyebrow tone={variant === 'for' ? 'accent' : 'muted'}>{title}</Eyebrow>
      <ul className={styles.forItems}>
        {items.map((item) => (
          <li key={item} className={styles.forItem}>
            <span className={styles.forIcon} aria-hidden="true">
              {variant === 'for' ? '✓' : '—'}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureSpread({
  num, title, kicker, body, visual, reverse = false,
}: { num: string; title: string; kicker: string; body: string; visual: React.ReactNode; reverse?: boolean }) {
  return (
    <motion.article
      className={`${styles.feat} ${reverse ? styles.featReverse : ''}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className={styles.featBody}>
        <div className={styles.featNum}>№ {num}</div>
        <p className={styles.featKicker}>{kicker}</p>
        <h3 className={styles.featTitle}>{title}</h3>
        <p className={styles.featCopy}>{body}</p>
      </div>
      <div className={styles.featVisual}>{visual}</div>
    </motion.article>
  );
}

function WorkoutPreview() {
  return (
    <div className={styles.workoutPrev}>
      <div className={styles.workoutPrevHead}>
        <span className={styles.workoutPrevDay}>THU · TODAY</span>
        <ZonePill zone={4} size="sm" />
      </div>
      <h4 className={styles.workoutPrevTitle}>Sweet-spot intervals · 3×12</h4>
      <p className={styles.workoutPrevBody}>
        Form is productive — push the engine. Three blocks at 88–92% FTP, full recovery between.
      </p>
      <div className={styles.stripe} aria-hidden="true">
        <span style={{ flex: 10, background: 'var(--c-z1)' }} />
        <span style={{ flex: 5, background: 'var(--c-z2)' }} />
        <span style={{ flex: 12, background: 'var(--c-z4)' }} />
        <span style={{ flex: 5, background: 'var(--c-z1)' }} />
        <span style={{ flex: 12, background: 'var(--c-z4)' }} />
        <span style={{ flex: 5, background: 'var(--c-z1)' }} />
        <span style={{ flex: 12, background: 'var(--c-z4)' }} />
        <span style={{ flex: 14, background: 'var(--c-z1)' }} />
      </div>
      <ul className={styles.workoutPrevMeta}>
        <li><span>1h 15m</span><span>duration</span></li>
        <li><span>78</span><span>TSS</span></li>
        <li><span>252 W</span><span>avg target</span></li>
      </ul>
    </div>
  );
}

function RoutePreview() {
  return (
    <div className={styles.routePrev}>
      <svg viewBox="0 0 280 140" aria-hidden="true" className={styles.routeMap}>
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--c-accent)" />
          </linearGradient>
        </defs>
        <path
          d="M10 120 C 40 80, 70 60, 100 70 S 160 110, 200 50 S 250 25, 270 30"
          fill="none" stroke="url(#rg)" strokeWidth={2.5} strokeLinecap="round"
        />
        <circle cx={10} cy={120} r={4} fill="var(--c-accent)" />
        <circle cx={270} cy={30} r={4} fill="var(--c-accent)" />
      </svg>
      <div className={styles.routeStats}>
        <div><span>Albis Loop</span><Pill tone="success">94% match</Pill></div>
        <ul>
          <li><span>62 km</span><span>distance</span></li>
          <li><span>1,140 m</span><span>elevation</span></li>
          <li><span>Z2 → Z4</span><span>zones hit</span></li>
        </ul>
      </div>
    </div>
  );
}

function PriceRow({ label, price, detail, emphasis }: { label: string; price: string; detail: string; emphasis?: boolean }) {
  return (
    <div className={`${styles.priceRow} ${emphasis ? styles.priceRowEmph : ''}`}>
      <span className={styles.priceLabel}>{label}</span>
      <span className={styles.pricePrice}>{price}</span>
      <span className={styles.priceDetail}>{detail}</span>
    </div>
  );
}

function FootCol({ title, links }: { title: string; links: { href: string; label: string; external?: boolean }[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <ul className={styles.footColList}>
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
            ) : (
              <a href={l.href}>{l.label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ringNum(): string { return '4,823'; } // unused export guard
void ringNum;

/** Climb-profile SVG — repeating mountain silhouette in muted accent.
 *  Generates depth without needing photography. */
function ClimbProfile({ dense = false }: { dense?: boolean }) {
  return (
    <svg className={styles.climb} viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="climbGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,77,0,.10)" />
          <stop offset="100%" stopColor="rgba(255,77,0,0)" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="rgba(255,77,0,.10)" strokeWidth={1}>
        {Array.from({ length: dense ? 9 : 7 }).map((_, i) => {
          const y = 700 - i * (dense ? 50 : 70);
          return (
            <path
              key={i}
              d={`M 0 ${y} Q 200 ${y - 35 - i * 8} 400 ${y - 10} T 800 ${y - 25 - i * 6} T 1200 ${y - 5 - i * 4} T 1600 ${y - 18}`}
            />
          );
        })}
      </g>
      <path
        d="M 0 700 L 0 480 Q 200 380 400 440 T 800 360 T 1200 420 T 1600 380 L 1600 700 Z"
        fill="url(#climbGrad)"
      />
    </svg>
  );
}
