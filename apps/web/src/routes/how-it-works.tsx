// apps/web/src/routes/how-it-works.tsx
//
// Sprint 14 / v11.3.0 — KPI explainer page.
// Public route, footer-linked from Today + AppFooter. Explains
// CTL / ATL / TSB / TSS / streak / year-end forecast in cyclist
// language so testers (and users) understand what the dashboard
// numbers mean and how they're calculated.
//
// Founder feedback: 'add a page into the footer to explain this data
// and how its calculated... why my fatigue is 77 and form +10? ... the
// year to date... the plan will project the total based on history and
// performance (this estimation needs to be explained into the footer
// page where do you explain the logic of the KPIs).'

import { createFileRoute } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Card } from '../components/Card/Card';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import styles from './how-it-works.module.css';

export const Route = createFileRoute('/how-it-works')({
  component: HowItWorks,
});

function HowItWorks() {
  return (
    <Container width="narrow">
      <header className={styles.head}>
        <Eyebrow rule tone="accent">Reference</Eyebrow>
        <h1 className={styles.h1}>How the numbers work</h1>
        <p className={styles.lede}>
          Cadence Club shows a handful of headline numbers — fitness, fatigue,
          form, weekly streak, year-to-date. Here's what each one means and
          how it's calculated. No black boxes; the math is the math.
        </p>
      </header>

      <Card tone="elev" pad="lg">
        <Eyebrow rule tone="accent">Fitness · CTL · Chronic Training Load</Eyebrow>
        <h2 className={styles.h2}>How much you've trained recently</h2>
        <p>
          CTL is the 42-day exponentially-weighted average of your daily Training
          Stress Score (TSS). It rewards consistent, repeated effort over weeks
          and months — a single hard ride doesn't move it much; a steady block
          of training does.
        </p>
        <p className={styles.formula}>
          CTL_today = CTL_yesterday + (TSS_today − CTL_yesterday) × (1 / 42)
        </p>
        <p className={styles.subtle}>
          The 42-day window is the long-standing convention used by training
          analytics tools (TrainingPeaks, Intervals.icu). It approximates how
          long an aerobic-training adaptation persists.
        </p>
      </Card>

      <Card tone="elev" pad="lg">
        <Eyebrow rule tone="accent">Fatigue · ATL · Acute Training Load</Eyebrow>
        <h2 className={styles.h2}>How tired you are right now</h2>
        <p>
          ATL is the 7-day exponentially-weighted average of TSS. It picks up
          recent hard work fast — a couple of big days will bump it visibly —
          and decays just as fast when you rest.
        </p>
        <p className={styles.formula}>
          ATL_today = ATL_yesterday + (TSS_today − ATL_yesterday) × (1 / 7)
        </p>
        <p className={styles.subtle}>
          <strong>Why fatigue can stay high after a rest week:</strong> ATL is
          a moving average. Even with TSS = 0 every day, it decays at ~14% per
          day — so a fatigue of 77 with no recent training drops to ~50 after a
          week off, not to 0. The math is correct; the metric is by design slow
          to forget.
        </p>
      </Card>

      <Card tone="elev" pad="lg">
        <Eyebrow rule tone="accent">Form · TSB · Training Stress Balance</Eyebrow>
        <h2 className={styles.h2}>Are you fresh, peaked, or buried?</h2>
        <p>
          Form is simply <code>CTL − ATL</code>. Positive numbers mean you're
          fresher than average for your fitness level (good for racing or hard
          intervals). Negative numbers mean you're carrying more fatigue than
          your fitness has adapted to (good for building, bad for racing).
        </p>
        <p className={styles.formula}>TSB = CTL − ATL</p>
        <ul className={styles.bullets}>
          <li><strong>+5 to +25</strong> — race-ready / peak window</li>
          <li><strong>+0 to +5</strong> — fresh, ready for hard sessions</li>
          <li><strong>−10 to 0</strong> — productive overload (training block)</li>
          <li><strong>below −20</strong> — overreaching; recovery overdue</li>
        </ul>
        <p className={styles.subtle}>
          <strong>Why form can be +10 after a quiet week:</strong> ATL drops
          faster than CTL, so a rest week increases TSB even with no training.
          That's the metric working as designed — your body is recovering and
          your relative freshness goes up.
        </p>
      </Card>

      <Card tone="elev" pad="lg">
        <Eyebrow rule tone="accent">TSS · Training Stress Score (per ride)</Eyebrow>
        <h2 className={styles.h2}>How hard a single ride was</h2>
        <p>
          TSS estimates how much a single ride costs you, on a scale where 100
          ≈ one hour at FTP (your one-hour max sustainable power). A 2-hour
          tempo ride is ~140 TSS; a 4-hour endurance ride is ~200 TSS; a hard
          interval session might be ~110 TSS in just 90 minutes.
        </p>
        <p className={styles.formula}>
          TSS = (duration_hours × Intensity_Factor² × 100)
        </p>
        <p>
          Intensity Factor (IF) is your ride's normalized power divided by your
          FTP. We approximate IF from the dominant Strava zone when normalized
          power isn't available:
        </p>
        <ul className={styles.bullets}>
          <li>Z1 ≈ 0.50 IF (recovery)</li>
          <li>Z2 ≈ 0.65 IF (endurance)</li>
          <li>Z3 ≈ 0.78 IF (tempo)</li>
          <li>Z4 ≈ 0.91 IF (sweet spot / threshold)</li>
          <li>Z5 ≈ 1.05 IF (VO₂)</li>
          <li>Z6 ≈ 1.10 IF (anaerobic)</li>
          <li>Z7 ≈ 1.15 IF (neuromuscular)</li>
        </ul>
        <p className={styles.subtle}>
          The estimate is a sanity check, not a coaching tool. If you have a
          power meter and Strava reports normalized power, that's used directly.
        </p>
      </Card>

      <Card tone="elev" pad="lg">
        <Eyebrow rule tone="accent">Weekly streak</Eyebrow>
        <h2 className={styles.h2}>Consecutive weeks with at least one training</h2>
        <p>
          The streak chip on your name counts <strong>consecutive ISO weeks
          (Mon-Sun) with at least one training ride</strong>. Cyclists train
          weekly, not daily; a 4-day commute streak isn't a training streak.
          The week resets every Monday.
        </p>
        <p className={styles.subtle}>
          If the current week has no training yet (e.g. it's Monday morning),
          the streak counts from last week so it doesn't drop to 0 every Monday.
          A streak of 0 means neither this week nor last week had a training.
        </p>
      </Card>

      <Card tone="elev" pad="lg">
        <Eyebrow rule tone="accent">Year-end distance forecast</Eyebrow>
        <h2 className={styles.h2}>Where you'll land by 31 December</h2>
        <p>
          The Today tab shows your year-to-date kilometres plus a projected
          year-end total. The current calculation is the simplest honest one:
        </p>
        <p className={styles.formula}>
          projected_km = (YTD_km ÷ days_elapsed_this_year) × 365
        </p>
        <p>
          Linear extrapolation from your pace so far. It assumes you keep
          riding at the average daily volume you've ridden since 1 January —
          no seasonality, no taper, no goal-event spike.
        </p>
        <p className={styles.subtle}>
          <strong>Why no fixed 8 000 km target:</strong> we used to show
          progress against a static goal. That number was made up. The
          projection above is honest — it's what you'll actually do at your
          current pace, not a target someone else picked. An AI-refined
          forecast that accounts for week-of-year variance, planned events,
          and recent training trends arrives in a later release.
        </p>
      </Card>

      <Card tone="elev" pad="lg">
        <Eyebrow rule tone="accent">What's <em>not</em> measured here</Eyebrow>
        <h2 className={styles.h2}>Honest limits</h2>
        <ul className={styles.bullets}>
          <li>
            <strong>HRV / sleep / nutrition</strong> — not collected. CTL/ATL/TSB
            assume you're recovering normally; if you're not, the numbers mislead.
          </li>
          <li>
            <strong>Non-cycling load</strong> — running, climbing, gym work
            isn't ingested. If you cross-train, the displayed CTL undercounts
            your actual fitness load.
          </li>
          <li>
            <strong>Power-meter calibration</strong> — TSS depends on accurate
            FTP. If your FTP is stale (set 6 months ago and you've improved),
            ride TSS will read low and so will CTL.
          </li>
          <li>
            <strong>Heart-rate zones</strong> — when power isn't available, we
            fall back to HR-based zones × the IF table above. HR drift, heat,
            and stress all affect HR independently of effort.
          </li>
        </ul>
      </Card>

      <p className={styles.footnote}>
        Want a number explained that isn't here? Open an issue at{' '}
        <a href="https://github.com/jose-reboredo/cycling-coach/issues" target="_blank" rel="noopener noreferrer">
          github.com/jose-reboredo/cycling-coach/issues
        </a>
        {' '}— the docs evolve with the questions.
      </p>
    </Container>
  );
}
