// Sprint 12 — Design system contract tests.
//
// Static-scan guards that lock the Sprint 12 design system invariants
// going forward. Same pattern as the v10.11.3 worker-cache-contract
// tests: read source files as text, assert structural properties.
//
// These tests do NOT require a running browser, network, or worker —
// they're cheap to run in CI and catch the exact regression class
// the Phase 1 inventory documented.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';

const APPS_WEB = resolve(__dirname, '../../..');
const SRC = resolve(APPS_WEB, 'src');
const TOKENS_TS = resolve(SRC, 'design/tokens.ts');
const TOKENS_CSS = resolve(SRC, 'design/tokens.css');

// =============================================================================
// HELPERS
// =============================================================================

function readAllCssModules(dir: string): { path: string; content: string }[] {
  const out: { path: string; content: string }[] = [];
  function walk(d: string) {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) {
        if (name === 'node_modules' || name === 'dist' || name === '__tests__') continue;
        walk(full);
      } else if (name.endsWith('.module.css')) {
        out.push({ path: full, content: readFileSync(full, 'utf8') });
      }
    }
  }
  walk(dir);
  return out;
}

// =============================================================================
// TOKEN SYSTEM CONTRACT
// =============================================================================

describe('design system — tokens', () => {
  it('tokens.ts exports a const named `tokens`', () => {
    const src = readFileSync(TOKENS_TS, 'utf8');
    expect(src).toMatch(/export const tokens =/);
  });

  it('tokens.ts declares the three-layer namespaces (primitive / semantic / component)', () => {
    const src = readFileSync(TOKENS_TS, 'utf8');
    expect(src).toMatch(/primitive:\s*{/);
    expect(src).toMatch(/semantic:\s*{/);
    expect(src).toMatch(/component:\s*{/);
  });

  it('tokens.ts declares the molten-orange anchor at primitive.orange[500] = #ff4d00', () => {
    const src = readFileSync(TOKENS_TS, 'utf8');
    // The anchor is locked since v9.1.1 and re-locked in Sprint 12.
    expect(src).toMatch(/'500':\s*'#ff4d00'/);
  });

  it('tokens.ts declares the display font (Source Serif Pro) for editorial type', () => {
    const src = readFileSync(TOKENS_TS, 'utf8');
    // Both must appear: a `display:` key in the font namespace AND
    // the Source Serif Pro family. Together they confirm the editorial
    // pairing addition without over-constraining the literal format.
    expect(src).toMatch(/font:\s*{[\s\S]*?display:/);
    expect(src).toMatch(/Source Serif Pro/);
  });

  it('tokens.ts declares named springs for forward-compat with native', () => {
    const src = readFileSync(TOKENS_TS, 'utf8');
    expect(src).toMatch(/spring:\s*{/);
    expect(src).toMatch(/default:\s*{[^}]*tension/);
  });

  it('tokens.ts declares safe-area semantic tokens', () => {
    const src = readFileSync(TOKENS_TS, 'utf8');
    expect(src).toMatch(/safeArea:\s*{/);
    expect(src).toMatch(/top:\s*['"]env\(safe-area-inset-top/);
  });

  it('tokens.css declares the Layer 2 semantic tokens consumed by new components', () => {
    const src = readFileSync(TOKENS_CSS, 'utf8');
    // Sample of canonical Layer 2 tokens — if any is missing, new components
    // referencing them will silently fall through to currentColor.
    expect(src).toMatch(/--surface-page:/);
    expect(src).toMatch(/--surface-card:/);
    expect(src).toMatch(/--surface-elevated:/);
    expect(src).toMatch(/--text-primary:/);
    expect(src).toMatch(/--text-secondary:/);
    expect(src).toMatch(/--accent-default:/);
    expect(src).toMatch(/--accent-hover:/);
    expect(src).toMatch(/--accent-pressed:/);
    expect(src).toMatch(/--border-default:/);
    expect(src).toMatch(/--state-success:/);
    expect(src).toMatch(/--state-danger:/);
    expect(src).toMatch(/--font-display:/);
    expect(src).toMatch(/--safe-area-bottom:/);
  });

  it('tokens.css declares the orange palette ramp 50–950', () => {
    const src = readFileSync(TOKENS_CSS, 'utf8');
    for (const step of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']) {
      expect(src).toMatch(new RegExp(`--color-orange-${step}:`));
    }
  });

  it('tokens.css declares warm-grey ramp 50–950 (warm bias, not slate)', () => {
    const src = readFileSync(TOKENS_CSS, 'utf8');
    for (const step of ['50', '400', '500', '900', '950']) {
      expect(src).toMatch(new RegExp(`--color-warm-grey-${step}:`));
    }
  });

  it('tokens.css preserves the Sprint 12 backward-compat aliases (--c-border)', () => {
    const src = readFileSync(TOKENS_CSS, 'utf8');
    // --c-border was added in pre-foundation cleanup (Calendar.module.css
    // referenced it 9× without declaration). Must remain.
    expect(src).toMatch(/--c-border:/);
  });
});

// =============================================================================
// HEX-LITERAL CONTRACT
// =============================================================================

describe('design system — hex-literal discipline', () => {
  // Phase 1 cleanup eliminated the one true literal hex outside primitives
  // (#0a0a0c in SessionRoutePicker.module.css). Going forward, any new hex
  // literal in a component CSS module is suspect — should reference tokens.

  // Acceptable: hex values that happen to appear in comments, OR known
  // existing literals we haven't migrated yet (Phase 4+ work).
  const ALLOWLIST_PATHS = [
    'design/tokens.css',           // primitives live here
    'design/reset.css',             // base reset
    'pages/Landing.module.css',    // hero stat colours, ClimbProfile gradient — Phase 5+ migration
    'pages/Dashboard.module.css',  // legacy literals — backlog migration
    'components/Calendar/Calendar.module.css',  // zone colours embedded
    'components/PmcStrip',         // PMC-specific colour math
    'components/ZonePill',         // zone-specific
    'components/ProgressRing',     // ring-specific
    'components/StreakHeatmap',    // heat-map specific
    'components/VolumeChart',      // chart-specific
    'components/AppFooter',        // legacy
    'components/RoutesPicker',     // legacy
  ];

  function isAllowlisted(path: string): boolean {
    return ALLOWLIST_PATHS.some((p) => path.includes(p));
  }

  it('Sprint 12 component rebuilds (Button / Card / EmptyState / Skeleton / Toast) contain no hex literals', () => {
    const newComponents = [
      'components/Button/Button.module.css',
      'components/Card/Card.module.css',
      'components/EmptyState/EmptyState.module.css',
      'components/Skeleton/Skeleton.module.css',
      'components/Toast/Toast.module.css',
    ];
    for (const path of newComponents) {
      const full = resolve(SRC, path);
      const src = readFileSync(full, 'utf8');
      // Strip CSS comments before scanning for hex.
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '');
      const hexMatches = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hexMatches, `${path} contains hex literals: ${hexMatches.join(', ')}`).toEqual([]);
    }
  });

  it('design-system showcase route uses no hex literals outside primitives', () => {
    const showcase = resolve(SRC, 'routes/design-system.module.css');
    const src = readFileSync(showcase, 'utf8');
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const hexMatches = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexMatches).toEqual([]);
  });

  it('warns on growth — total hex-literal count in non-allowlisted CSS modules', () => {
    const modules = readAllCssModules(SRC);
    const nonAllowlisted = modules.filter((m) => !isAllowlisted(m.path));
    let totalHex = 0;
    for (const { path, content } of nonAllowlisted) {
      const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
      const hex = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      totalHex += hex.length;
      // The Phase 1 inventory baseline was ~85 across all modules including
      // allowlisted ones. Non-allowlisted should remain at 0 or very low
      // until Phase 4+ migrates the legacy modules.
      if (hex.length > 0) {
        // Surface for review without failing — Phase 4+ work.
        // eslint-disable-next-line no-console
        console.warn(`${basename(path)} carries ${hex.length} hex literal(s) — migration target`);
      }
    }
    // Hard ceiling — fails if non-allowlisted growth exceeds this.
    expect(totalHex).toBeLessThanOrEqual(20);
  });
});

// =============================================================================
// TOUCH-TARGET CONTRACT (mobile-first)
// =============================================================================

describe('design system — touch-target discipline', () => {
  it('tokens.css declares the touch-target floor tokens', () => {
    const src = readFileSync(TOKENS_CSS, 'utf8');
    expect(src).toMatch(/--hit-min:\s*44px/);
    expect(src).toMatch(/--hit-comfy:\s*48px/);
    expect(src).toMatch(/--hit-big:\s*56px/);
  });

  it('Button + Toast dismiss button reference --hit-* tokens for height', () => {
    const button = readFileSync(resolve(SRC, 'components/Button/Button.module.css'), 'utf8');
    const toast = readFileSync(resolve(SRC, 'components/Toast/Toast.module.css'), 'utf8');
    expect(button).toMatch(/--hit-min/);
    expect(toast).toMatch(/--hit-min/);
  });

  it('BottomNav declares safe-area-bottom handling (iOS PWA requirement)', () => {
    const nav = readFileSync(
      resolve(SRC, 'components/BottomNav/BottomNav.module.css'),
      'utf8',
    );
    // The robust pattern from v9.7.5 iOS Safari hardening.
    expect(nav).toMatch(/safe-area-inset-bottom/);
  });
});

// =============================================================================
// COMPONENT 8-STATE INVARIANTS
// =============================================================================

describe('design system — component states', () => {
  it('Button declares default + hover + active + focus-visible + disabled + loading states', () => {
    const css = readFileSync(resolve(SRC, 'components/Button/Button.module.css'), 'utf8');
    expect(css).toMatch(/\.root[^\{]*\{/);            // default
    expect(css).toMatch(/:hover/);                     // hover
    expect(css).toMatch(/:active/);                    // active
    expect(css).toMatch(/:focus-visible/);             // focus
    expect(css).toMatch(/:disabled/);                  // disabled
    expect(css).toMatch(/\.loading/);                  // loading
  });

  it('Card declares interactive variant with hover + active + focus-visible', () => {
    const css = readFileSync(resolve(SRC, 'components/Card/Card.module.css'), 'utf8');
    expect(css).toMatch(/\.interactive\b/);
    expect(css).toMatch(/\.interactive:hover/);
    expect(css).toMatch(/\.interactive:active/);
    expect(css).toMatch(/\.interactive:focus-visible/);
  });

  it('Skeleton declares prefers-reduced-motion override', () => {
    const css = readFileSync(resolve(SRC, 'components/Skeleton/Skeleton.module.css'), 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});

// =============================================================================
// PWA MANIFEST CONTRACT
// =============================================================================

describe('design system — PWA manifest', () => {
  const MANIFEST = resolve(APPS_WEB, 'public/manifest.webmanifest');
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

  it('name is the current Cadence Club brand (no pre-rebrand drift)', () => {
    expect(manifest.name).toBe('Cadence Club');
  });

  it('theme_color matches tokens.css --c-canvas (#0a0a0c)', () => {
    expect(manifest.theme_color).toBe('#0a0a0c');
    expect(manifest.background_color).toBe('#0a0a0c');
  });

  it('PWA shortcuts URLs match current TanStack Router file-based routes', () => {
    const urls = (manifest.shortcuts ?? []).map((s: { url: string }) => s.url);
    // Old hash-based URLs (#today, #train) were stale; current routes are
    // file-based.
    for (const url of urls) {
      expect(url).toMatch(/^\/dashboard\/[a-z-]+$/);
    }
  });
});
