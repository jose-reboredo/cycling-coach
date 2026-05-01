// Cadence Club line-icon library — Sprint 5 / v9.7.2 (#59).
// Branded for CC: 1.6px stroke, 24×24 viewBox, currentColor.
// Each icon's JSDoc notes the persona it primarily serves (we are
// persona-focused, not product-focused — founder rule 2026-05-01).

import type { SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

function svgProps(p: IconProps): SVGProps<SVGSVGElement> {
  const { size, ...rest } = p;
  return {
    width: size ?? 24,
    height: size ?? 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

/** **Today** — clock face. Marco wakes early; Sofia checks the day's
 *  plan; Léa starts here. Universal "this is now" signal. */
export function TodayIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

/** **Train** — performance line peak. Marco's primary tab; signals
 *  effort + zones. Visually distinct from Rides bar chart. */
export function TrainIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path d="M3 17l5-9 4 5 4-7 5 11" />
    </svg>
  );
}

/** **Rides** — bar chart, fitness history. All personas. The cumulative
 *  log of past sessions. */
export function RidesIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <rect x={3} y={13} width={4} height={8} rx={1} />
      <rect x={10} y={8} width={4} height={13} rx={1} />
      <rect x={17} y={4} width={4} height={17} rx={1} />
    </svg>
  );
}

/** **You** — profile circle + shoulders. Identity tab. Marco's settings;
 *  Sofia's club role; Léa's profile (mostly empty for casual). */
export function YouIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

/** **Overview** — 4-square dashboard grid. Sofia's at-a-glance entry
 *  point to her club; Marco's shortcut to recent activity; Léa's "what
 *  is this club about" landing. */
export function OverviewIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <rect x={4} y={4} width={7} height={7} rx={1} />
      <rect x={13} y={4} width={7} height={7} rx={1} />
      <rect x={4} y={13} width={7} height={7} rx={1} />
      <rect x={13} y={13} width={7} height={7} rx={1} />
    </svg>
  );
}

/** **Schedule** — calendar with one cell highlighted. Sofia plans the
 *  week; Marco checks "is this a hard day?"; Léa's "when's the ride?". */
export function ScheduleIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <rect x={3} y={5} width={18} height={16} rx={2} />
      <path d="M3 9h18" />
      <path d="M8 3v4M16 3v4" />
      <rect x={7} y={13} width={4} height={4} rx={0.5} fill="currentColor" stroke="none" />
    </svg>
  );
}

/** **Members** — three figures, one in front. Sofia's roster check;
 *  Léa's "who's in this club?" reassurance scan; Marco's "who's at
 *  Saturday's pace?". */
export function MembersIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <circle cx={9} cy={8} r={3.5} />
      <path d="M3 20c1-3.5 3.5-5 6-5s5 1.5 6 5" />
      <circle cx={17} cy={9} r={2.5} />
      <path d="M14 20c0-2 1-3.5 3-4" />
    </svg>
  );
}

/** **Metrics** — line chart with peaks + dots. Marco's competitive edge
 *  (CTL/ATL/TSB across the club); Sofia's growth tracking (members,
 *  hours, distance). */
export function MetricsIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path d="M3 20h18" />
      <path d="M5 16l4-4 3 3 5-7 2 3" />
      <circle cx={9} cy={12} r={1.2} fill="currentColor" stroke="none" />
      <circle cx={12} cy={15} r={1.2} fill="currentColor" stroke="none" />
      <circle cx={17} cy={8} r={1.2} fill="currentColor" stroke="none" />
    </svg>
  );
}

// =============================================================================
// Sprint 5 / v9.7.4 (#66) — Event-type icons replacing emoji placeholders.
// Branded for Cadence Club: same 1.6px stroke / 24×24 / currentColor as the
// nav icons above. Used in ClubEventModal Format chips, ScheduleTab filter
// chips, EventDetailDrawer drawerType badge, and (cosmetic) calendar pills.
// =============================================================================

/** **Ride** — bicycle silhouette. Marco's primary format; default for new
 *  events. Two wheels + frame; geometric, not photographic. */
export function RideIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <circle cx={6} cy={17} r={3.5} />
      <circle cx={18} cy={17} r={3.5} />
      <path d="M6 17 L11 9 L17 17" />
      <path d="M9 9 L14 9" />
      <path d="M14 9 L18 17" />
    </svg>
  );
}

/** **Social** — coffee cup with steam. Sofia's "post-ride coffee" anchor;
 *  Léa's "let's hang out" entry point. Cycling-club coffee culture is
 *  iconic; the steam line signals warmth + social. */
export function SocialIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path d="M5 9 H15 V17 A3 3 0 0 1 12 20 H8 A3 3 0 0 1 5 17 Z" />
      <path d="M15 11 H17 A2 2 0 0 1 17 15 H15" />
      <path d="M8 6 v-2 M11 6 v-2" />
    </svg>
  );
}

/** **Race** — chequered flag. Marco's race-day signal; the universally
 *  recognised cycling motif for "this is competitive, plan accordingly". */
export function RaceIcon(p: IconProps = {}) {
  return (
    <svg {...svgProps(p)}>
      <path d="M5 4 v17" />
      <rect x={5} y={5} width={14} height={8} />
      <rect x={5.5} y={5.5} width={3.25} height={3.5} fill="currentColor" stroke="none" />
      <rect x={12} y={5.5} width={3.25} height={3.5} fill="currentColor" stroke="none" />
      <rect x={8.75} y={9} width={3.25} height={3.5} fill="currentColor" stroke="none" />
      <rect x={15.25} y={9} width={3.25} height={3.5} fill="currentColor" stroke="none" />
    </svg>
  );
}
