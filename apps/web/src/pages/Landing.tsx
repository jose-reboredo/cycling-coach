import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Button } from '../components/Button/Button';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Pill } from '../components/Pill/Pill';
import { GrainOverlay } from '../components/GrainOverlay/GrainOverlay';
import { ZonePill } from '../components/ZonePill/ZonePill';
import { PmcStrip } from '../components/PmcStrip/PmcStrip';
import { ProgressRing } from '../components/ProgressRing/ProgressRing';
import { TopBar } from '../components/TopBar/TopBar';
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
          <Button href={connectUrl()} size="sm" variant="primary" withArrow>
            Connect
          </Button>
        }
      />

      {/* HERO */}
      <section className={styles.hero}>
        <ClimbProfile />
        <GrainOverlay intensity={0.18} />

        <Container width="base">
          <motion.div className={styles.heroInner} {...fade}>
            <Pill tone="accent" dot>
              Cycling clubs that actually feel like a club · v9
            </Pill>

            <h1 className={styles.heroH1}>
              Train solo.
              <span className={styles.heroH1Italic}> Ride together. </span>
              Smarter.
            </h1>

            <p className={styles.heroLede}>
              Connect Strava in 10 seconds. Join your club, or start one. See what's
              on this week. An AI coach that learns your form — and helps your crew
              plan rides together. Free to start. Works on your phone.
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
                <Eyebrow>Today's session</Eyebrow>
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
              Three riders, one
              <em> shared toolkit</em>.
            </h2>
            <p className={styles.sectionLede}>
              We're brutally specific about who this serves. If you don't recognise yourself
              on the left, you'll save 30 seconds and we'll save you a download.
            </p>
          </div>
          <div className={styles.forGrid}>
            <ForList variant="for" title="For you if…" items={[
              'You like seeing what shape you\'re in at-a-glance, not buried four taps deep',
              'You captain a Saturday crew and want better tools than a WhatsApp group',
              'You\'d rather belong to a cycling club than scroll a kudos feed',
              'You read your numbers the morning after, before the kettle',
              'You want AI that helps quietly — not pop-ups every five minutes',
              'You\'d rather pay for what you use than for a monthly subscription',
            ]} />
            <ForList variant="not" title="Not for you if…" items={[
              'You just want to log rides for kudos',
              'Gamification, badges and leaderboards are the value proposition',
              'You want chat with strangers\' bikes',
              'You\'re looking for a casual fitness tracker',
              'You want to be told you "crushed it" every day',
              'A monthly subscription is the only pricing you trust',
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
              Solo training brain.
              <em> Plus a club layer</em>.
            </h2>
          </div>

          <FeatureSpread
            num="01"
            title="Know what shape you're in — every day"
            kicker="The first thing you see in the morning."
            body="A simple read on form, fitness and fatigue, computed nightly from every ride you have on Strava. Sits at the top of Today, paired with the personal calendar — your week of planned sessions and club rides on the same surface. (Power data unlocks the precision; even without it you get a baseline.)"
            visual={<PmcStrip ctl={78} atl={82} tsb={-4} ctlDelta={2.4} atlDelta={-1.1} tsbDelta={3.5} />}
          />

          <FeatureSpread
            num="02"
            title="Plan and ride structured sessions"
            kicker="Workouts in hours, by zone, with target watts."
            body="Block out a sweet-spot day, an endurance ride or a recovery spin. Personal sessions live on the same calendar as club rides — colour-coded by zone, time-blocked to actual duration. Edit, mark done or cancel from the drawer; your form metrics catch up automatically. (Auto-populated week plans from the AI coach — shipping next sprint.)"
            visual={<WorkoutPreview />}
            reverse
          />

          <FeatureSpread
            num="03"
            title="A club that runs itself"
            kicker="Overview · Schedule · Members · Metrics"
            body="Captain a Saturday crew without WhatsApp gymnastics. Members RSVP from the calendar, the roster sorts itself, FTP stays private by default. The app drafts the weekly Circle Note for you — free, included. Built for the captain, the commuter and the power-meter rider in the same crew."
            visual={<ClubLayerPreview />}
          />
        </Container>
      </section>

      {/* BUILT · SHIPPING NEXT — v9.12.5 (founder Marco-persona feedback)
       *  Cyclist-first transparency: what's live today, what's queued. */}
      <section className={styles.builtSection} id="built">
        <Container width="base">
          <div className={styles.sectionHead}>
            <Eyebrow rule tone="accent">№ 02b — Built · Shipping next</Eyebrow>
            <h2 className={styles.sectionH2}>
              What's <em>here today</em>.<br/>
              And what's queued.
            </h2>
            <p className={styles.sectionLede}>
              Cyclist-first, ship-weekly. Live cyclist feedback shapes the
              order — Marco testers, Sofia testers, real rides on real bikes.
              You can see what's coming on the <a href="/whats-next" className={styles.inlineLink}>roadmap</a>.
            </p>
          </div>

          <div className={styles.builtGrid}>
            <div className={styles.builtCol}>
              <h3>✓ Built · live now</h3>
              <ul>
                <li><span className={styles.builtTag}>Today</span><span><strong>Daily form.</strong> CTL/ATL/TSB read on Today, computed nightly from every Strava ride.</span></li>
                <li><span className={styles.builtTag}>Today</span><span><strong>AI session brief.</strong> One-tap workout for today — zone-tagged, target watts, duration in hours.</span></li>
                <li><span className={styles.builtTag}>Rides</span><span><strong>Full ride history.</strong> Splits, segments, photos, polylines — every ride lazy-fetched and cached.</span></li>
                <li><span className={styles.builtTag}>Train</span><span><strong>Zone model · Z1–Z7.</strong> Strava-aligned palette, structured workout stripe, FTP-driven math.</span></li>
                <li><span className={styles.builtTag}>Schedule</span><span><strong>Personal scheduler.</strong> Month/Week/Day calendar aggregating club rides + your planned sessions on one surface.</span></li>
                <li><span className={styles.builtTag}>Schedule</span><span><strong>Plan a session.</strong> Title, date, time, zone, duration in hours, target watts, notes — your training brief.</span></li>
                <li><span className={styles.builtTag}>Schedule</span><span><strong>Calendar time-blocking.</strong> Events visually book actual duration — 15:00 + 2h shows 15:00–17:00.</span></li>
                <li><span className={styles.builtTag}>Schedule</span><span><strong>Drawer actions.</strong> Edit, mark done, cancel a personal session. Unsubscribe from a club ride. All in one tap.</span></li>
                <li><span className={styles.builtTag}>Schedule</span><span><strong>Zone-coloured pills.</strong> Personal sessions colour-coded Z1–Z7 so you read intensity at a glance.</span></li>
                <li><span className={styles.builtTag}>Clubs</span><span><strong>Create or join.</strong> Captain a crew or join an existing one with an invite code. Free forever.</span></li>
                <li><span className={styles.builtTag}>Clubs</span><span><strong>Schedule + RSVP.</strong> Members confirm from the calendar; the going list is live, FTP stays private.</span></li>
                <li><span className={styles.builtTag}>Clubs</span><span><strong>AI Circle Note.</strong> Weekly recap drafted by the coach — captain edits in 30 seconds and ships.</span></li>
                <li><span className={styles.builtTag}>Clubs</span><span><strong>Members + Metrics tabs.</strong> Roster, roles, captain analytics — hours, distance, ride count, growth.</span></li>
                <li><span className={styles.builtTag}>App</span><span><strong>PWA install.</strong> Add to home screen on iOS/Android — feels native, runs offline-shell.</span></li>
                <li><span className={styles.builtTag}>App</span><span><strong>Strava OAuth.</strong> 10-second connect, tokens stay in the worker, no email signup.</span></li>
              </ul>
            </div>
            <div className={styles.builtCol}>
              <h3 className={styles.builtNext}>→ Queued · Sprint 6 / next</h3>
              <ul>
                <li><span className={styles.builtTag}>v9.13</span><span><strong>AI plan persistence.</strong> The coach auto-populates a week of structured sessions onto your calendar — review, tweak, ride.</span></li>
                <li><span className={styles.builtTag}>v9.14</span><span><strong>Shareable rides.</strong> Public link to a personal session — Strava-style preview card. Send to a friend, they sign up to RSVP.</span></li>
                <li><span className={styles.builtTag}>v9.10</span><span><strong>Live route picker.</strong> Your saved Strava routes ranked against today's target — open in Strava with one tap.</span></li>
                <li><span className={styles.builtTag}>S6</span><span><strong>Multi-timezone.</strong> IANA-aware events for global clubs — author in Zürich, ride in Lisbon, everyone sees their wall-clock.</span></li>
                <li><span className={styles.builtTag}>S6</span><span><strong>Club analytics.</strong> Captain dashboard with member trends — who's training, who's drifting, who's about to peak.</span></li>
                <li><span className={styles.builtTag}>S6</span><span><strong>Club invite links.</strong> Share a club with one URL — no captcha, no email, just join and ride.</span></li>
                <li><span className={styles.builtTag}>S7</span><span><strong>Goals + races.</strong> Set a target event, the coach builds the plan backwards from race day.</span></li>
                <li><span className={styles.builtTag}>S7</span><span><strong>FTP detection.</strong> Auto-update FTP from a 20-minute power test the coach prescribes — no manual edits.</span></li>
              </ul>
            </div>
          </div>
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
              Free to start. Always free for your club. The only thing you might pay
              for is your personal AI coach — about 50¢ a month if you use it daily.
              Skip it and it's $0 forever.
            </p>
          </div>
          <div className={styles.priceGrid}>
            <PriceRow label="The app" price="Free" detail="No subscription. No tier upgrades. No login wall." />
            <PriceRow label="Your club" price="Free" detail="The schedule, the roster, the weekly recap — all included." />
            <PriceRow label="Strava connection" price="Free" detail="Connect in 10 seconds. Your tokens stay in your browser." />
            <PriceRow label="Personal AI coach" price="~50¢/mo" detail="Optional. Bring your own AI key. Skip it and your training brain still works." />
            <PriceRow label="Most riders pay" price="< $1/mo" detail="Or nothing at all. Up to you." emphasis />
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
              One click. Your Strava history imported. Your training brain ready.
              Your club waiting. All yours, all on your phone, all free.
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

function ClubLayerPreview() {
  return (
    <div className={styles.routePrev}>
      <div className={styles.routeStats}>
        <div>
          <span>Saturday Crew</span>
          <Pill tone="accent">AI Circle Note · weekly</Pill>
        </div>
        <ul>
          <li><span>42 h</span><span>collective · 28d</span></li>
          <li><span>1,240 km</span><span>distance</span></li>
          <li><span>3</span><span>group rides</span></li>
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
