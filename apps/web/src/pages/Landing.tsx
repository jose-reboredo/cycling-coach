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
          <Button href={connectUrl()} size="sm" variant="primary">
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
              <Button href={connectUrl()} size="lg" variant="primary">
                Connect with Strava
              </Button>
              <Button href="#what" size="lg" variant="ghost" withArrow>
                See what you get
              </Button>
            </div>

            <ul className={styles.heroFacts}>
              <li><span className={styles.heroFactNum}>10s</span><span>typical OAuth round-trip</span></li>
              <li><span className={styles.heroFactNum}>$0</span><span>monthly subscription</span></li>
              <li><span className={styles.heroFactNum}>7</span><span>Coggan zones + neuromuscular</span></li>
              <li><span className={styles.heroFactNum}>~$0.02</span><span>per AI plan (BYOK)</span></li>
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
              <span className={styles.bandNum}>7</span>
              <span className={styles.bandLabel}>Coggan + neuromuscular zones</span>
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
            body="A simple read on form, fitness and fatigue, computed nightly from every ride. No four-tap menu hunt — it's right there when you open the app. (Power data unlocks the precision; even without it you get a baseline.)"
            visual={<PmcStrip ctl={78} atl={82} tsb={-4} ctlDelta={2.4} atlDelta={-1.1} tsbDelta={3.5} />}
          />

          <FeatureSpread
            num="02"
            title="Today's session, ready to ride"
            kicker="One tap. The workout, the zones, the watts."
            body="The plan reads your form and matches the effort. Hard day after a strong week. Easy day after a slammed one. The session lands as a structured brief — duration in hours, zone-tagged blocks, target watts. Tick it done as you ride; your form curve catches up automatically."
            visual={<WorkoutPreview />}
            reverse
          />

          <FeatureSpread
            num="03"
            title="Your week, on one calendar"
            kicker="Solo sessions + club rides — same surface, zone-coloured."
            body="Block out tomorrow's sweet-spot day or Sunday's recovery spin in seconds. Your personal sessions sit next to your club rides on the same calendar — colour-coded by zone so you read the week at a glance. Edit, swap, mark done, cancel. The calendar is honest about your time: a 2-hour ride visually books two hours."
            visual={<SchedulePreview />}
          />

          <FeatureSpread
            num="04"
            title="A club that runs itself"
            kicker="Overview · Schedule · Members · Metrics."
            body="Captain a Saturday crew without WhatsApp gymnastics. Members RSVP from the calendar, the roster sorts itself, FTP stays private by default. The app drafts the weekly Circle Note for you — free, included. Built for the captain, the commuter and the power-meter rider in the same crew."
            visual={<ClubLayerPreview />}
            reverse
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
            <Button href={connectUrl()} size="lg" variant="primary">
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

/** v9.12.6 — SchedulePreview. Mini-week showing personal sessions
 *  (zone-coloured) + a club ride (accent) on the same surface — visual
 *  proof of the FeatureSpread #03 promise: "Your week, on one calendar". */
function SchedulePreview() {
  type DayItem =
    | { kind: 'session'; zone: 1|2|3|4|5|6|7; title: string; dur: string }
    | { kind: 'club'; title: string; dur: string };
  const week: { day: string; items: DayItem[] }[] = [
    { day: 'TUE', items: [{ kind: 'session', zone: 2, title: 'Endurance', dur: '1.5h' }] },
    { day: 'WED', items: [{ kind: 'session', zone: 4, title: 'Sweet-spot', dur: '1h' }] },
    { day: 'THU', items: [] },
    { day: 'FRI', items: [{ kind: 'session', zone: 1, title: 'Recovery', dur: '0.75h' }] },
    { day: 'SAT', items: [{ kind: 'club', title: 'Saturday Crew', dur: '2.5h' }] },
    { day: 'SUN', items: [{ kind: 'session', zone: 3, title: 'Tempo', dur: '2h' }] },
  ];
  return (
    <div className={styles.schedPrev}>
      <div className={styles.schedHead}>
        <span className={styles.schedHeadDay}>THIS WEEK</span>
        <Pill tone="accent">Marco · FTP 285</Pill>
      </div>
      <ul className={styles.schedList}>
        {week.map((d) => (
          <li key={d.day} className={styles.schedRow}>
            <span className={styles.schedDay}>{d.day}</span>
            <div className={styles.schedItems}>
              {d.items.length === 0 ? (
                <span className={styles.schedRest}>rest</span>
              ) : (
                d.items.map((it, i) => (
                  <span
                    key={i}
                    className={
                      it.kind === 'club'
                        ? `${styles.schedPill} ${styles.schedPillClub}`
                        : `${styles.schedPill} ${styles[`schedPillZ${it.zone}`]}`
                    }
                  >
                    <span className={styles.schedPillTitle}>{it.title}</span>
                    <span className={styles.schedPillDur}>{it.dur}</span>
                  </span>
                ))
              )}
            </div>
          </li>
        ))}
      </ul>
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
