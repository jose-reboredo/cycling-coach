// Cadence Club — Design tokens · v2.0 (Sprint 12)
// ---------------------------------------------------------------
// Source-of-truth for the design system. `tokens.css` is generated
// from this file (see `generate-tokens.ts` — committed; not run at
// build).
//
// THREE-LAYER TAXONOMY (Sprint 12):
//   - Layer 1 — primitive: raw values (color ramps, spacing scale,
//     type sizes, easing curves). Internal scale; component CSS
//     should not reference these directly.
//   - Layer 2 — semantic: intent (`accent.default`, `surface.page`,
//     `text.primary`). What component CSS consumes.
//   - Layer 3 — component: component-scoped (`button.bgPrimary*`,
//     `card.shadow*`). Declared per rebuilt component; opt-in.
//
// BACKWARD COMPATIBILITY:
//   The flat tokens at the top of this file (`color`, `space`,
//   `radius`, `shadow`, `motion`, `type`, `hit`, `z`, `breakpoint`)
//   are PRESERVED. Existing CSS consumers continue to work
//   unchanged. The new layers are additive.
//
// ORIGINAL HEADER (preserved for project history):
//   PARS — Performance Dark · v1.0
//   Reject: AI-slop aesthetic. Pure black canvas, molten orange,
//   mono numerals. Two families. Square-ish radii. Earned shadows.
// ---------------------------------------------------------------

export const tokens = {
  /** Type — Geist + Geist Mono (workhorse pair, drawn for instruments).
   *  Sprint 12: Source Serif Pro added for editorial display + section H2s. */
  font: {
    sans: '"Geist", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"Geist Mono", ui-monospace, "JetBrains Mono", monospace',
    /** Sprint 12 — editorial display + section heads (e.g. № 01 framing). */
    display: '"Source Serif Pro", "Source Serif 4", Georgia, serif',
  },

  /** Color — dark cockpit canvas + molten orange. */
  color: {
    canvas: '#0a0a0c',
    surface: '#16181d',
    surfaceElev: '#1f232a',
    surfacePressed: '#252a33',
    surfaceOverlay: 'rgba(10,10,12,.72)',

    text: '#f0f1f3',
    textMuted: '#7d8290',
    textFaint: '#7a8290', // v9.1.4 contrast lift — was #454a55 (2.16:1 fail, 49 use sites)

    line: 'rgba(255,255,255,.06)',
    lineStrong: 'rgba(255,255,255,.14)',
    /** Sprint 12 / Phase 1 cleanup — added so Calendar.module.css
     *  references resolve. Aliased to line until Phase 3 component
     *  layer introduces a real semantic border token. */
    border: 'rgba(255,255,255,.06)',

    accent: '#ff4d00', // molten orange — earned, not Strava
    accentDeep: '#cc3e00',
    accentSoft: 'rgba(255,77,0,.10)',
    accentGlow: 'rgba(255,77,0,.22)',
    accentLight: '#ff7a3d', // AA-passing accent for ≤14px text on canvas (~5.2:1)

    /** Strava 7-zone power model (Z1–Z6 = Coggan + Z7 = Neuromuscular).
     *  Z1 recovery · Z2 endurance · Z3 tempo
     *  Z4 threshold · Z5 vo2 · Z6 anaerobic
     *  Z7 neuromuscular (>150% FTP — sprints) */
    zone: {
      z1: '#3b8ce8',
      z2: '#4ade80',
      z3: '#facc15',
      z4: '#fb923c',
      z5: '#ef4444',
      z6: '#a855f7',
      z7: '#a55be0', // v9.1.4 contrast lift — was #6b21a8 (2.23:1 fail when used as text)
    },

    status: {
      success: '#22c55e',
      successSoft: 'rgba(34,197,94,.12)',
      warn: '#f59e0b',
      warnSoft: 'rgba(245,158,11,.12)',
      danger: '#ef4444',
      dangerSoft: 'rgba(239,68,68,.12)',
    },

    /** Strava brand — used only for Strava-specific UI (sync, attribution). */
    strava: '#fc4c02',
  },

  /** Spacing — 4 px base, mobile-first. */
  space: {
    px: '1px',
    '0.5': '2px',
    '1': '4px',
    '1.5': '6px',
    '2': '8px',
    '2.5': '10px',
    '3': '12px',
    '4': '16px',
    '5': '20px',
    '6': '24px',
    '7': '28px',
    '8': '32px',
    '10': '40px',
    '12': '48px',
    '14': '56px',
    '16': '64px',
    '20': '80px',
    '24': '96px',
    '32': '128px',
  },

  /** Radius — square-ish, instrument-coded. NOT bubble shapes. */
  radius: { xs: '2px', sm: '4px', md: '6px', lg: '10px', xl: '16px', full: '9999px' },

  /** Shadow — earned. Mostly we use 1px lines. Glow for accent moments. */
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,.4)',
    md: '0 8px 24px rgba(0,0,0,.45)',
    lg: '0 24px 64px rgba(0,0,0,.55)',
    glow: '0 0 0 1px rgba(255,77,0,.25), 0 8px 28px rgba(255,77,0,.18)',
    inner: 'inset 0 1px 0 rgba(255,255,255,.04)',
  },

  /** Motion — purposeful. `prefers-reduced-motion` zeros these in CSS. */
  motion: {
    duration: {
      instant: '50ms',
      fast: '150ms',
      base: '220ms',
      slow: '420ms',
      lazy: '720ms',
      ring: '1200ms', // synced PMC ring fills
    },
    ease: {
      out: 'cubic-bezier(.4,0,.2,1)',
      inOut: 'cubic-bezier(.65,0,.35,1)',
      back: 'cubic-bezier(.34,1.56,.64,1)', // ring overshoot
      sharp: 'cubic-bezier(.4,0,.6,.2)',
    },
  },

  /** Type scale — modular. Mono = numerals, sans = prose. */
  type: {
    monoXxs: { size: '10px', lh: '14px', tracking: '.16em', weight: 500 },
    monoXs: { size: '11px', lh: '16px', tracking: '.14em', weight: 500 },
    monoSm: { size: '13px', lh: '18px', tracking: '.10em', weight: 500 },
    monoMd: { size: '15px', lh: '20px', tracking: '.08em', weight: 500 },
    monoLg: { size: '18px', lh: '24px', tracking: '.06em', weight: 500 },
    monoXl: { size: '24px', lh: '28px', tracking: '.04em', weight: 500 },
    mono2xl: { size: '36px', lh: '40px', tracking: '-.01em', weight: 600 },
    mono3xl: { size: '54px', lh: '54px', tracking: '-.025em', weight: 600 },
    mono4xl: { size: '80px', lh: '80px', tracking: '-.035em', weight: 700 },
    mono5xl: { size: '120px', lh: '108px', tracking: '-.045em', weight: 700 },

    sansXs: { size: '12px', lh: '18px', tracking: '0', weight: 400 },
    sansSm: { size: '14px', lh: '22px', tracking: '0', weight: 400 },
    sansMd: { size: '16px', lh: '26px', tracking: '0', weight: 400 },
    sansLg: { size: '18px', lh: '28px', tracking: '-.01em', weight: 500 },
    sansXl: { size: '22px', lh: '30px', tracking: '-.012em', weight: 500 },
    sans2xl: { size: '28px', lh: '34px', tracking: '-.018em', weight: 600 },
    sans3xl: { size: '40px', lh: '44px', tracking: '-.025em', weight: 600 },
    sans4xl: { size: '64px', lh: '64px', tracking: '-.035em', weight: 700 },
    sans5xl: { size: '96px', lh: '92px', tracking: '-.045em', weight: 700 },

    /** Sprint 12 — Source Serif Pro display scale.
     *  Used for section H2s (`<h2>`), the № editorial framing,
     *  hero H1, and other publication-style chrome. */
    displayMd: { size: '28px', lh: '34px', tracking: '-.012em', weight: 600, family: 'display' },
    displayLg: { size: '40px', lh: '44px', tracking: '-.020em', weight: 600, family: 'display' },
    displayXl: { size: '64px', lh: '64px', tracking: '-.028em', weight: 600, family: 'display' },
  },

  /** Hit targets — 44 px accessibility minimum. */
  hit: { min: '44px', comfy: '48px', big: '56px' },

  /** Z-index — explicit scale. */
  z: {
    base: 0,
    raised: 1,
    dropdown: 50,
    sticky: 100,
    nav: 200,
    overlay: 400,
    modal: 500,
    toast: 700,
  },

  /** Breakpoints — mobile-first, named for the form factor we design at. */
  breakpoint: {
    sm: '375px', // iPhone Mini portrait — design baseline
    md: '414px', // iPhone Pro Max portrait
    tabletPortrait: '600px', // BottomNav→TopTabs handoff (per v9.7.2)
    lg: '768px', // iPad portrait / large phone landscape
    xl: '1024px', // iPad landscape
    xxl: '1280px', // desktop minimum
    xxxl: '1536px', // wide desktop
  },

  // ============================================================
  // Sprint 12 — Three-layer additions (Layer 1 + Layer 2 + Layer 3).
  // The existing flat tokens above are preserved for backward
  // compatibility; new components reference these layered tokens.
  // ============================================================

  /** Layer 1 — primitive ramps. Internal scale; component CSS should
   *  consume Layer 2 / 3, not these. */
  primitive: {
    /** Orange ramp (50 → 950). Anchor at 500 = #ff4d00 (locked since v9.1.1). */
    orange: {
      '50': '#fff4ee',
      '100': '#ffe5d4',
      '200': '#ffc8a8',
      '300': '#ffa370',
      '400': '#ff7a3d', // = legacy `accentLight` — AA-passing on canvas at small sizes
      '500': '#ff4d00', // = legacy `accent` — anchor
      '600': '#cc3e00', // = legacy `accentDeep`
      '700': '#a02f00',
      '800': '#732200',
      '900': '#501700',
      '950': '#2a0c00',
    },
    /** Warm-grey ramp (50 → 950). Subtle warm bias vs pure slate.
     *  Existing surface / text values preserved at their canonical steps. */
    warmGrey: {
      '50': '#f0f1f3', // = legacy `text`
      '100': '#e1e3e6',
      '200': '#c8ccd1',
      '300': '#a8aeb6',
      '400': '#7d8290', // = legacy `textMuted`
      '500': '#62687a',
      '600': '#4a505f',
      '700': '#353a47',
      '800': '#1f232a', // = legacy `surfaceElev`
      '900': '#16181d', // = legacy `surface`
      '950': '#0a0a0c', // = legacy `canvas`
    },
    /** Alpha steps — orange. Used for hover bg / soft fills / overlays. */
    orangeAlpha: {
      '08': 'rgba(255,77,0,.08)',
      '12': 'rgba(255,77,0,.12)',
      '22': 'rgba(255,77,0,.22)', // = legacy `accentGlow`
      '32': 'rgba(255,77,0,.32)',
      '50': 'rgba(255,77,0,.50)',
    },
    /** Alpha steps — white (line / divider / surface overlay variants). */
    whiteAlpha: {
      '06': 'rgba(255,255,255,.06)', // = legacy `line`
      '10': 'rgba(255,255,255,.10)',
      '14': 'rgba(255,255,255,.14)', // = legacy `lineStrong`
      '20': 'rgba(255,255,255,.20)',
      '32': 'rgba(255,255,255,.32)',
    },
  },

  /** Layer 2 — semantic tokens. Components consume these (preferred). */
  semantic: {
    surface: {
      page: '#0a0a0c',          // = primitive.warmGrey.950
      card: '#16181d',          // = primitive.warmGrey.900
      elevated: '#1f232a',      // = primitive.warmGrey.800
      pressed: '#252a33',
      overlay: 'rgba(10,10,12,.72)',
    },
    text: {
      primary: '#f0f1f3',       // = primitive.warmGrey.50
      secondary: '#7d8290',     // = primitive.warmGrey.400
      faint: '#7a8290',
      onAccent: '#0a0a0c',      // text used on top of accent fill
    },
    accent: {
      default: '#ff4d00',       // = primitive.orange.500
      hover: '#ff7a3d',         // = primitive.orange.400 (lighter for on-dark hover)
      pressed: '#cc3e00',       // = primitive.orange.600
      soft: 'rgba(255,77,0,.10)',
      strongSoft: 'rgba(255,77,0,.22)',
      ringGlow: '0 0 0 1px rgba(255,77,0,.25), 0 8px 28px rgba(255,77,0,.18)',
    },
    border: {
      default: 'rgba(255,255,255,.06)',
      strong: 'rgba(255,255,255,.14)',
    },
    state: {
      success: '#22c55e',
      successSoft: 'rgba(34,197,94,.12)',
      warning: '#f59e0b',
      warningSoft: 'rgba(245,158,11,.12)',
      danger: '#ef4444',
      dangerSoft: 'rgba(239,68,68,.12)',
      info: '#3b8ce8',
      infoSoft: 'rgba(59,140,232,.12)',
    },
    focusRing: {
      width: '2px',
      color: '#ff4d00',
      offset: '2px',
    },
  },

  /** Layer 3 — component tokens. Declared per component as it's
   *  rebuilt in Phase 3. Empty initially; populated as Button,
   *  Card, Form fields, Empty-state, Skeleton, Toast land. */
  component: {
    button: {
      // Populated when Button is rebuilt (Phase 3 step 5).
    },
    card: {
      // Populated when Card is rebuilt (Phase 3 step 6).
    },
  },

  /** Sprint 12 — named springs for forward-compat with React Native /
   *  Capacitor. On web, `motion`'s spring transitions consume these.
   *  On native, the equivalent useSpring/Animated.spring config maps
   *  directly. Mass / Tension / Friction in `motion` library terms. */
  spring: {
    default: { mass: 1, tension: 280, friction: 24 },
    emphasised: { mass: 1, tension: 200, friction: 22 },
    snap: { mass: 1, tension: 380, friction: 26 },
    soft: { mass: 1, tension: 180, friction: 18 },
  },

  /** Sprint 12 — safe-area semantic tokens. Resolves to env() on web;
   *  bridge-supplied in native (Capacitor / React Native). */
  safeArea: {
    top: 'env(safe-area-inset-top, 0)',
    bottom: 'env(safe-area-inset-bottom, 0)',
    left: 'env(safe-area-inset-left, 0)',
    right: 'env(safe-area-inset-right, 0)',
  },
} as const;

export type Tokens = typeof tokens;
