// ============================================================
// Cycling Coach — Confluence canonical documentation source
// ============================================================
// Each entry below is a page that lives under the project homepage on
// Confluence. The /admin/document-release endpoint upserts these on every
// prod deploy.
//
// Update mechanic:
//   • Spec pages (this array): init-once. Re-pushed only when the storage
//     XHTML changes (we hash + compare via DOCS_KV). To update the
//     architecture / API / etc. doc, edit the storage value in this file
//     and ship a deploy.
//   • Roadmap page: always regenerated from GitHub Issues.
//   • Releases page: append-only — one child per WORKER_VERSION.
//
// Numeric prefix on titles is a UX hint to keep them in order on the
// homepage tree. Confluence sorts children alphanumerically by default.
// ============================================================

const STUB = (name, stepRef) => `<h1>${name}</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Placeholder — full content lands in <strong>${stepRef}</strong> (see <a href="https://github.com/jose-reboredo/cycling-coach/issues/23">issue #23</a>).</p></ac:rich-text-body></ac:structured-macro>
<p><em>This page is auto-managed. Don't edit it in Confluence — the canonical content lives in <code>src/docs.js</code> in the repo. Pushes happen on every prod deploy via <code>/admin/document-release</code>.</em></p>`;

export const SPEC_PAGES = [
  {
    slug: 'systems-architecture',
    title: '1. Systems & Architecture',
    storage: STUB('Systems & Architecture', 'Step B1'),
  },
  {
    slug: 'apis',
    title: '2. APIs',
    storage: STUB('APIs', 'Step B2'),
  },
  {
    slug: 'interfaces',
    title: '3. User Interfaces',
    storage: STUB('User Interfaces', 'Step B3'),
  },
  {
    slug: 'functional-spec',
    title: '4. Functional Specification',
    storage: STUB('Functional Specification', 'Step B4'),
  },
  {
    slug: 'technical-spec',
    title: '5. Technical Specification',
    storage: STUB('Technical Specification', 'Step B5'),
  },
  {
    slug: 'security',
    title: '6. Security',
    storage: STUB('Security', 'Step B6'),
  },
];

// Pages from earlier doc structure to be cleaned up on first run after the
// refactor. Removed via Confluence API (purge=true). Safe — these were
// auto-generated stubs with no manual edits.
export const LEGACY_PAGES_TO_REMOVE = [
  'Functional documentation',
  'Technical documentation',
];
