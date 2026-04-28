// PARS — Performance Dark · v1.0
// ---------------------------------------------------------------
// Single source of truth for the cycling-coach design system.
// Reject: AI-slop aesthetic. Pure black canvas, molten orange,
// mono numerals. Two families. Square-ish radii. Earned shadows.
// ---------------------------------------------------------------

export const tokens = {
  /** Type — Geist + Geist Mono (sibling pair, drawn for instruments). */
  font: {
    sans: '"Geist", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"Geist Mono", ui-monospace, "JetBrains Mono", monospace',
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
    textFaint: '#454a55',

    line: 'rgba(255,255,255,.06)',
    lineStrong: 'rgba(255,255,255,.14)',

    accent: '#ff4d00', // molten orange — earned, not Strava
    accentDeep: '#cc3e00',
    accentSoft: 'rgba(255,77,0,.10)',
    accentGlow: 'rgba(255,77,0,.22)',

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
      z7: '#6b21a8',
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
    lg: '768px', // iPad portrait / large phone landscape
    xl: '1024px', // iPad landscape
    xxl: '1280px', // desktop minimum
    xxxl: '1536px', // wide desktop
  },
} as const;

export type Tokens = typeof tokens;
