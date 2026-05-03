// apps/web/src/routes/how-it-works.tsx
//
// Sprint 14 / v11.4.0 — KPI explainer page rebuilt with the
// FeatureSpread template extracted from Landing's /#what section.
// Picture + text alternating layout, same molecule as the marketing
// landing — consolidates the visual experience across surfaces per
// founder feedback.
//
// Each section reuses an existing visual component (PmcStrip, ZonePill
// stack, etc.) so testers see the same building blocks they encounter
// in the actual Today / Schedule / Train tabs — making the explanation
// concrete, not abstract.

import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { FeatureSpread } from '../components/FeatureSpread/FeatureSpread';
import { PmcStrip } from '../components/PmcStrip/PmcStrip';
import { ZonePill } from '../components/ZonePill/ZonePill';
import { GrainOverlay } from '../components/GrainOverlay/GrainOverlay';
import styles from './how-it-works.module.css';

export const Route = createFileRoute('/how-it-works')({
  component: HowItWorks,
});

function HowItWorks() {
  return (
    <div className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <GrainOverlay intensity={0.18} />
        <Container width="narrow">
          <motion.div
            className={styles.heroInner}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <Eyebrow rule tone="accent">Reference</Eyebrow>
            <h1 className={styles.heroH1}>
              How the numbers <em>actually work</em>.
            </h1>
            <p className={styles.heroLede}>
              Cadence Club shows a handful of headline numbers — fitness, fatigue,
              form, weekly streak, year-to-date. Here's what each one means and
              how it's calculated. No black boxes; the math is the math.
            </p>
          </motion.div>
        </Container>
      </section>

      {/* SECTIONS */}
      <section className={styles.features}>
        <Container width="base">
          <div className={styles.sectionHead}>
            <Eyebrow rule tone="accent">№ 02 — The numbers</Eyebrow>
            <h2 className={styles.sectionH2}>
              The headline metrics, <em>explained</em>.
            </h2>
          </div>

          <FeatureSpread
            num="01"
            kicker="Have you trained enough to ride this hard?"
            title="Fitness · CTL · Chronic Training Load"
            visual={<PmcStrip ctl={78} atl={82} tsb={-4} ctlDelta={2.4} atlDelta={-1.1} tsbDelta={3.5} />}
            bodyNode={
              <>
                <p>
                  CTL is the 42-day exponentially-weighted average of your daily
                  Training Stress Score. It rewards consistent, repeated effort over
                  weeks and months — a single hard ride doesn't move it much; a
                  steady block of training does.
                </p>
                <pre className={styles.formula}>
                  CTL_today = CTL_yesterday + (TSS_today − CTL_yesterday) × (1 / 42)
                </pre>
                <p className={styles.subtle}>
                  The 42-day window approximates how long an aerobic-training
                  adaptation persists. Same convention TrainingPeaks and
                  Intervals.icu use.
                </p>
              </>
            }
          />

          <FeatureSpread
            num="02"
            kicker="How tired are you right now?"
            title="Fatigue · ATL · Acute Training Load"
            reverse
            visual={
              <DecayChart
                label="ATL decay over 14 days, no training"
                values={[77, 66, 56, 48, 41, 35, 30, 26, 22, 19, 16, 14, 12, 10]}
                accent
              />
            }
            bodyNode={
              <>
                <p>
                  ATL is the 7-day exponentially-weighted average of TSS. It picks
                  up recent hard work fast — a couple of big days will bump it
                  visibly — and decays just as fast when you rest.
                </p>
                <pre className={styles.formula}>
                  ATL_today = ATL_yesterday + (TSS_today − ATL_yesterday) × (1 / 7)
                </pre>
                <p className={styles.subtle}>
                  <strong>Why fatigue can stay high after a rest week:</strong> ATL
                  is a moving average. Even with TSS = 0 every day, it decays at
                  ~14% per day — so a fatigue of 77 with no recent training drops
                  to ~50 after a week off, not to 0. The math is correct; the
                  metric is by design slow to forget.
                </p>
              </>
            }
          />

          <FeatureSpread
            num="03"
            kicker="Are you fresh, peaked, or buried?"
            title="Form · TSB · Training Stress Balance"
            visual={
              <FormScale
                rows={[
                  { range: '+5 to +25', label: 'Race-ready · peak window' },
                  { range: '+0 to +5', label: 'Fresh, ready for hard sessions' },
                  { range: '−10 to 0', label: 'Productive overload' },
                  { range: 'below −20', label: 'Overreaching · recovery overdue' },
                ]}
              />
            }
            bodyNode={
              <>
                <p>
                  Form is simply <code>CTL − ATL</code>. Positive means you're
                  fresher than average for your fitness level (good for racing or
                  hard intervals). Negative means you're carrying more fatigue
                  than your fitness has adapted to (good for building, bad for
                  racing).
                </p>
                <pre className={styles.formula}>TSB = CTL − ATL</pre>
                <p className={styles.subtle}>
                  <strong>Why form can be +10 after a quiet week:</strong> ATL drops
                  faster than CTL, so a rest week increases TSB even with no
                  training. That's the metric working as designed — your body is
                  recovering and your relative freshness goes up.
                </p>
              </>
            }
          />

          <FeatureSpread
            num="04"
            kicker="How hard was a single ride?"
            title="TSS · Training Stress Score"
            reverse
            visual={
              <ZoneStack
                rows={[
                  { z: 1, name: 'Recovery', if: '0.50' },
                  { z: 2, name: 'Endurance', if: '0.65' },
                  { z: 3, name: 'Tempo', if: '0.78' },
                  { z: 4, name: 'Sweet spot · threshold', if: '0.91' },
                  { z: 5, name: 'VO₂', if: '1.05' },
                  { z: 6, name: 'Anaerobic', if: '1.10' },
                  { z: 7, name: 'Neuromuscular', if: '1.15' },
                ]}
              />
            }
            bodyNode={
              <>
                <p>
                  TSS estimates how much a single ride costs you, on a scale where
                  100 ≈ one hour at FTP (your one-hour max sustainable power).
                  A 2-hour tempo ride is ~140 TSS; a 4-hour endurance ride is
                  ~200 TSS; a hard interval session might be ~110 TSS in just
                  90 minutes.
                </p>
                <pre className={styles.formula}>
                  TSS = duration_hours × IF² × 100
                </pre>
                <p className={styles.subtle}>
                  IF is your ride's normalized power divided by your FTP. We
                  approximate IF from the dominant Strava zone when normalized
                  power isn't available. Power-meter riders get the precise
                  number directly.
                </p>
              </>
            }
          />

          <FeatureSpread
            num="05"
            kicker="The chip on your name."
            title="Weekly streak"
            visual={
              <StreakChips
                weeks={[
                  { label: 'Apr 1', filled: true },
                  { label: 'Apr 8', filled: true },
                  { label: 'Apr 15', filled: true },
                  { label: 'Apr 22', filled: true },
                  { label: 'Apr 29', filled: true },
                  { label: 'May 6', filled: false, current: true },
                ]}
              />
            }
            bodyNode={
              <>
                <p>
                  The streak chip counts <strong>consecutive ISO weeks (Mon-Sun)
                  with at least one training ride</strong>. Cyclists train weekly,
                  not daily; a 4-day commute streak isn't a training streak. The
                  week resets every Monday.
                </p>
                <p className={styles.subtle}>
                  If the current week has no training yet (e.g. it's Monday
                  morning), the streak counts from last week so it doesn't drop
                  to 0 every Monday. A streak of 0 means neither this week nor
                  last week had a training.
                </p>
              </>
            }
          />

          <FeatureSpread
            num="06"
            kicker="Where you'll land by 31 December."
            title="Year-end distance forecast"
            reverse
            id="forecast"
            visual={
              <ForecastBar
                ytdKm={3599}
                projectedKm={10680}
                daysElapsed={123}
                totalDays={365}
              />
            }
            bodyNode={
              <>
                <p>
                  The Today tab shows your year-to-date kilometres plus a
                  projected year-end total. The current calculation is the
                  simplest honest one:
                </p>
                <pre className={styles.formula}>
                  projected_km = (YTD_km ÷ days_elapsed) × 365
                </pre>
                <p>
                  Linear extrapolation from your pace so far. It assumes you keep
                  riding at the average daily volume you've ridden since 1 January
                  — no seasonality, no taper, no goal-event spike.
                </p>
                <p className={styles.subtle}>
                  An AI-refined forecast that accounts for week-of-year variance,
                  planned events, and recent training trends arrives in a later
                  release.
                </p>
              </>
            }
          />

          <FeatureSpread
            num="07"
            kicker="Honest about the gaps."
            title="What's not measured"
            visual={
              <NotMeasured
                items={[
                  { name: 'HRV / sleep / nutrition', why: 'Not collected. CTL/ATL/TSB assume normal recovery; if you\'re not, the numbers mislead.' },
                  { name: 'Non-cycling load', why: 'Running, climbing, gym work isn\'t ingested. Cross-training under-counts your fitness load.' },
                  { name: 'Power-meter calibration', why: 'TSS depends on accurate FTP. Stale FTP makes ride TSS read low.' },
                  { name: 'Heart-rate zones', why: 'When power isn\'t available, HR-based zones × the IF table apply. HR drift, heat, stress all affect HR independently of effort.' },
                ]}
              />
            }
            bodyNode={
              <>
                <p>
                  These metrics are useful — but they're not the whole picture.
                  They assume normal recovery, single-sport load, accurate FTP,
                  and (when no power meter) a stable HR response. None of those
                  hold every day for every rider. Read the numbers as a sanity
                  check, not a coaching tool.
                </p>
                <p className={styles.subtle}>
                  Want a metric explained that isn't here? Open an issue at{' '}
                  <a
                    href="https://github.com/jose-reboredo/cycling-coach/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    github.com/jose-reboredo/cycling-coach/issues
                  </a>
                  . The docs evolve with the questions.
                </p>
              </>
            }
          />
        </Container>
      </section>
    </div>
  );
}

/* ----- visual sub-components (page-local) ----- */

function DecayChart({
  label,
  values,
  accent = false,
}: { label: string; values: number[]; accent?: boolean }) {
  const max = Math.max(...values);
  return (
    <div className={styles.decay}>
      <div className={styles.decayHead}>
        <span className={styles.decayLabel}>{label}</span>
      </div>
      <div className={styles.decayBars} aria-hidden="true">
        {values.map((v, i) => (
          <div
            key={i}
            className={`${styles.decayBar} ${accent ? styles.decayBarAccent : ''}`}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <div className={styles.decayAxis}>
        <span>day 1</span>
        <span>day 14</span>
      </div>
      <p className={styles.decayCaption}>
        Starting fatigue 77 → ~10 by day 14 with no training.
      </p>
    </div>
  );
}

function FormScale({ rows }: { rows: { range: string; label: string }[] }) {
  return (
    <div className={styles.formScale}>
      {rows.map((r) => (
        <div key={r.range} className={styles.formScaleRow}>
          <span className={styles.formScaleRange}>{r.range}</span>
          <span className={styles.formScaleLabel}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function ZoneStack({ rows }: { rows: { z: number; name: string; if: string }[] }) {
  return (
    <div className={styles.zoneStack}>
      {rows.map((r) => (
        <div key={r.z} className={styles.zoneStackRow}>
          <ZonePill zone={r.z as 1 | 2 | 3 | 4 | 5 | 6 | 7} size="sm" />
          <span className={styles.zoneStackName}>{r.name}</span>
          <span className={styles.zoneStackIf}>IF ≈ {r.if}</span>
        </div>
      ))}
    </div>
  );
}

function StreakChips({
  weeks,
}: { weeks: { label: string; filled: boolean; current?: boolean }[] }) {
  return (
    <div className={styles.streakChips}>
      {weeks.map((w, i) => (
        <div
          key={i}
          className={`${styles.streakChip} ${w.filled ? styles.streakFilled : ''} ${w.current ? styles.streakCurrent : ''}`}
        >
          <span className={styles.streakDot} aria-hidden="true">
            {w.filled ? '●' : w.current ? '○' : '·'}
          </span>
          <span className={styles.streakLabel}>{w.label}</span>
        </div>
      ))}
      <p className={styles.streakCaption}>
        5-week streak. Current week (May 6) hasn't had a training yet.
      </p>
    </div>
  );
}

function ForecastBar({
  ytdKm,
  projectedKm,
  daysElapsed,
  totalDays,
}: { ytdKm: number; projectedKm: number; daysElapsed: number; totalDays: number }) {
  const ytdPct = (ytdKm / projectedKm) * 100;
  const dayPct = (daysElapsed / totalDays) * 100;
  return (
    <div className={styles.forecast}>
      <div className={styles.forecastNums}>
        <div>
          <strong className={styles.forecastBig}>{ytdKm.toLocaleString()}</strong>
          <span className={styles.forecastUnit}>km so far</span>
        </div>
        <div className={styles.forecastArrow} aria-hidden="true">→</div>
        <div>
          <strong className={styles.forecastBig}>{projectedKm.toLocaleString()}</strong>
          <span className={styles.forecastUnit}>projected</span>
        </div>
      </div>
      <div className={styles.forecastBar}>
        <div className={styles.forecastBarFill} style={{ width: `${ytdPct}%` }} />
        <div className={styles.forecastBarMarker} style={{ left: `${dayPct}%` }} aria-hidden="true" />
      </div>
      <p className={styles.forecastCaption}>
        Day {daysElapsed} of {totalDays} ({Math.round(dayPct)}% of the year). At
        your current pace, you'll ride <strong>{projectedKm.toLocaleString()} km</strong>
        {' '}by 31 Dec.
      </p>
    </div>
  );
}

function NotMeasured({ items }: { items: { name: string; why: string }[] }) {
  return (
    <div className={styles.notMeasured}>
      {items.map((it) => (
        <div key={it.name} className={styles.notMeasuredRow}>
          <span className={styles.notMeasuredX} aria-hidden="true">×</span>
          <div className={styles.notMeasuredBody}>
            <strong>{it.name}</strong>
            <span>{it.why}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
