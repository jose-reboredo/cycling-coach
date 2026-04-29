import { useState } from 'react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { useClubMembers, useClubs } from '../../hooks/useClubs';
import type { Club, ClubMember } from '../../lib/clubsApi';
import styles from './ClubDashboard.module.css';

interface ClubDashboardProps {
  clubId: number;
  clubName: string;
  role: string;
}

type Tab = 'overview' | 'schedule' | 'members' | 'metrics';

/**
 * ClubDashboard — restructured per Saturday Crew Wireframes (claude.ai/design
 * 2026-04-30 bundle). Information architecture from wireframe 01 "Overview tab":
 *
 *   1. Cover hero — italic-em club name + metadata strip + role pill
 *   2. Tabs row — Overview / Schedule / Members / Metrics
 *   3. Hero invite CTA — "★ share is the primary feature · expires 7 days"
 *      (admin-only; promoted from buried aside to full-width)
 *   4. Stat tiles — Hours collective, Distance, Group rides, New members
 *   5. Members aside — circular initial + name + FTP/W
 *   6. Circle note placeholder — admin-posted update
 *   7. Switch-back hint
 *
 * Schedule / Members / Metrics tabs render coming-soon placeholders today;
 * Overview is the only fully-implemented tab. Visual styling stays in PARS
 * dark + molten orange (no cream) per the v9.1.1 palette revert.
 */
export function ClubDashboard({ clubId, clubName, role }: ClubDashboardProps) {
  const members = useClubMembers(clubId);
  const memberCount = members.data?.length ?? 0;
  const clubs = useClubs();
  const club: Club | undefined = clubs.data?.find((c) => c.id === clubId);
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState<Tab>('overview');

  const createdYear = club?.created_at
    ? new Date(club.created_at * 1000).getFullYear()
    : new Date().getFullYear();

  return (
    <div className={styles.root}>
      {/* COVER HERO — striped placeholder background, club name italic-em, metadata strip */}
      <header className={styles.cover}>
        <div className={styles.coverStripes} aria-hidden="true" />
        <div className={styles.coverInner}>
          <div className={styles.coverMetaTop}>
            <span className={styles.coverEyebrow}>
              Est. {createdYear} · {memberCount} {memberCount === 1 ? 'member' : 'members'} · Private
            </span>
            {isAdmin ? (
              <Pill dot tone="accent">{role}</Pill>
            ) : (
              <Pill dot>{role}</Pill>
            )}
          </div>
          <h1 className={styles.coverTitle}>
            {clubName.endsWith('.') ? clubName : <>{clubName}<em>.</em></>}
          </h1>
        </div>
      </header>

      {/* TABS — Overview / Schedule / Members / Metrics. Only Overview is functional today. */}
      <nav className={styles.tabs} aria-label="Club views">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')} label="Overview" />
        <TabBtn active={tab === 'schedule'} onClick={() => setTab('schedule')} label="Schedule" disabled />
        <TabBtn active={tab === 'members'} onClick={() => setTab('members')} label="Members" disabled />
        <TabBtn active={tab === 'metrics'} onClick={() => setTab('metrics')} label="Metrics" disabled />
      </nav>

      {tab === 'overview' && (
        <>
          {/* HERO INVITE CTA — admin-only. Wireframes: "★ share is the primary feature · expires 7 days" */}
          {isAdmin && club?.invite_code && (
            <section className={styles.section}>
              <Eyebrow rule tone="accent">Invite</Eyebrow>
              <InviteHeroCta code={club.invite_code} />
            </section>
          )}

          {/* STAT TILES — wireframe labels */}
          <section className={styles.section}>
            <Eyebrow>The circle, this month</Eyebrow>
            <div className={styles.statRow}>
              <StatTile value="—" label="Hours collective" />
              <StatTile value="0" label="Distance · km" />
              <StatTile value="0" label="Group rides" />
              <StatTile value={String(memberCount)} label="Members" />
            </div>
          </section>

          {/* CIRCLE NOTE — admin-only, placeholder while no posts table exists */}
          {isAdmin && (
            <section className={styles.section}>
              <Eyebrow rule>Circle note</Eyebrow>
              <div className={styles.circleNote}>
                <p className={styles.circleNoteBody}>
                  Posts and weekly updates land here once a circle-note table exists in
                  D1. For now, share the invite link above to grow the crew.
                </p>
                <span className={styles.circleNoteSig}>— Cadence · Circle Layer</span>
              </div>
            </section>
          )}

          {/* COACH AI — captain-managed Anthropic key (MVP per BA spec). Visible to all
           * members; only admin (captain) can edit the key. Feedback generation against
           * member-aggregated data lands when a club-rides table exists. */}
          <section className={styles.section}>
            <Eyebrow rule tone="accent">Coach AI</Eyebrow>
            <ClubCoachCard clubId={clubId} isAdmin={isAdmin} />
          </section>

          {/* MEMBERS LIST */}
          <section className={styles.section}>
            <Eyebrow rule>Members · {String(memberCount).padStart(2, '0')}</Eyebrow>
            <MembersList state={members} />
          </section>

          {/* COMING NEXT */}
          <section className={styles.section}>
            <Eyebrow rule tone="accent">Coming next</Eyebrow>
            <ul className={styles.roadmap}>
              <li>Group rides — schedule a session, members RSVP, post-ride debrief</li>
              <li>Collective goals — distance / elevation / consistency targets</li>
              <li>Coach dashboard — admin view of every member's weekly load</li>
              <li>Schedule + Members + Metrics tabs — full views for each</li>
            </ul>
          </section>

          <p className={styles.hint}>
            Personal training stats are hidden in club view. Switch back to
            <strong> My account</strong> via the context pill in the top bar.
          </p>
        </>
      )}

      {tab !== 'overview' && (
        <div className={styles.tabPlaceholder}>
          <Eyebrow rule tone="accent">Coming soon</Eyebrow>
          <p className={styles.tabPlaceholderBody}>
            The <strong>{tab}</strong> tab is wireframed. Schedule lays out a calendar
            view with filters; Members renders a sortable roster with FTP / hours /
            attendance; Metrics surfaces collective load and form trends. None ship in
            v9.1.2 — they wait on backend tables (rides, attendance, aggregated load).
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- subcomponents ---------- */

function TabBtn({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.tab} ${active ? styles.tabActive : ''}`}
      onClick={onClick}
      disabled={disabled && !active}
      aria-current={active ? 'page' : undefined}
    >
      {label}
      {disabled && !active && <span className={styles.tabSoon}>Soon</span>}
    </button>
  );
}

function MembersList({ state }: {
  state: ReturnType<typeof useClubMembers>;
}) {
  if (state.isLoading) {
    return <div className={styles.empty}>Loading members…</div>;
  }
  if (state.isError) {
    return <div className={styles.error}>Could not load members. Try again later.</div>;
  }
  const members = state.data ?? [];
  if (members.length === 0) {
    return <div className={styles.empty}>No members yet.</div>;
  }
  return (
    <div className={styles.members}>
      {members.map((m) => <MemberRow key={m.athlete_id} member={m} />)}
    </div>
  );
}

function MemberRow({ member }: { member: ClubMember }) {
  const fullName = [member.firstname, member.lastname].filter(Boolean).join(' ').trim() || `Athlete ${member.athlete_id}`;
  const initials =
    [member.firstname?.[0], member.lastname?.[0]].filter(Boolean).join('').toUpperCase() ||
    '?';
  const joinedDate = new Date(member.joined_at * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const isAdmin = member.role === 'admin';
  return (
    <div className={styles.member}>
      {member.profile_url ? (
        <img src={member.profile_url} alt="" className={styles.avatar} />
      ) : (
        <span className={styles.avatarFallback} aria-hidden="true">{initials}</span>
      )}
      <div className={styles.memberBody}>
        <span className={styles.memberName}>{fullName}</span>
        <span className={styles.memberJoined}>Joined {joinedDate}</span>
      </div>
      {isAdmin ? <Pill dot tone="accent">{member.role}</Pill> : <Pill dot>{member.role}</Pill>}
    </div>
  );
}

function InviteHeroCta({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${code}`
    : `/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this invite link', link);
    }
  }

  return (
    <div className={styles.inviteHero}>
      <div className={styles.inviteUrlBox}>
        <span className={styles.inviteUrlLabel}>Share with your circle</span>
        <code className={styles.inviteUrl}>{link}</code>
      </div>
      <button type="button" className={styles.inviteCtaBtn} onClick={copy} aria-live="polite">
        <span aria-hidden="true">↗ </span>
        {copied ? 'Copied — share now' : 'Share Invite Link'}
      </button>
      <span className={styles.inviteHeroAnnot}>
        ★ Share is the primary feature · invite link is permanent until a regenerate flow ships
      </span>
    </div>
  );
}

/**
 * ClubCoachCard — captain-managed Anthropic API key + Coach AI feedback gate.
 *
 * MVP per BA spec (v9.1.2): captain (admin) enters their own Anthropic API key
 * locally; key is stored in localStorage under `cc_clubAiKey:${clubId}` (NOT
 * synced to D1, NOT shared with other members — admin-only secret). When set,
 * the card surfaces a "Generate weekly feedback" affordance; when not set,
 * non-admins see "Captain has not yet set up Coach AI" and admins see the
 * key-entry form.
 *
 * Why localStorage and not D1: we don't have a clubs.api_key column yet, and
 * adding one means a migration + an admin-only edit endpoint + a server-side
 * encryption story (we don't store user Anthropic keys in D1 today either —
 * personal AI Coach also lives in localStorage). Matching that pattern keeps
 * the security posture consistent.
 *
 * Feedback rendering itself is a placeholder until a club-rides aggregate
 * table exists — without aggregated member training data we can't usefully
 * call /coach for the club. Ships the key-entry UX so the captain can be
 * onboarded ahead of the data path.
 */
function ClubCoachCard({ clubId, isAdmin }: { clubId: number; isAdmin: boolean }) {
  const storageKey = `cc_clubAiKey:${clubId}`;
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return window.localStorage.getItem(storageKey) ?? ''; } catch { return ''; }
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const hasKey = apiKey.trim().length > 0;
  const masked = hasKey ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : '';

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    try { window.localStorage.setItem(storageKey, trimmed); } catch { /* swallow */ }
    setApiKey(trimmed);
    setDraft('');
    setEditing(false);
  }

  function clear() {
    try { window.localStorage.removeItem(storageKey); } catch { /* swallow */ }
    setApiKey('');
  }

  // Non-admin view
  if (!isAdmin) {
    return (
      <div className={styles.coachCard}>
        {hasKey ? (
          <>
            <p className={styles.coachBody}>
              The captain has connected an Anthropic API key. Coach AI feedback will
              surface here once the club-rides aggregate data path ships.
            </p>
            <span className={styles.coachStatus}>
              <span className={styles.coachDot} aria-hidden="true" /> Coach connected
            </span>
          </>
        ) : (
          <p className={styles.coachBody}>
            Captain has not yet set up Coach AI. Once they connect an Anthropic
            API key, weekly feedback for the circle will appear here.
          </p>
        )}
      </div>
    );
  }

  // Admin view — key entry / management
  return (
    <div className={styles.coachCard}>
      {!hasKey && !editing && (
        <>
          <p className={styles.coachBody}>
            Add your Anthropic API key to power Coach AI for the circle. The key
            stays in your browser only — it isn't shared with members or stored
            on our servers. About <strong>$0.02</strong> per generated weekly
            feedback. <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className={styles.coachLink}>Get a key →</a>
          </p>
          <button
            type="button"
            className={styles.coachPrimaryBtn}
            onClick={() => setEditing(true)}
          >
            Connect Anthropic key
          </button>
        </>
      )}

      {!hasKey && editing && (
        <form
          className={styles.coachForm}
          onSubmit={(e) => { e.preventDefault(); save(); }}
        >
          <label className={styles.coachLabel}>
            Anthropic API key
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={styles.coachInput}
              autoFocus
            />
          </label>
          <div className={styles.coachFormRow}>
            <button type="submit" className={styles.coachPrimaryBtn} disabled={!draft.trim()}>
              Save key
            </button>
            <button
              type="button"
              className={styles.coachSecondaryBtn}
              onClick={() => { setEditing(false); setDraft(''); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {hasKey && (
        <>
          <div className={styles.coachStatusRow}>
            <span className={styles.coachStatus}>
              <span className={styles.coachDot} aria-hidden="true" /> Coach connected
            </span>
            <span className={styles.coachKeyPreview}>{masked}</span>
          </div>
          <p className={styles.coachBody}>
            Coach AI feedback for the circle ships once a club-rides aggregate
            table exists in D1. The key you entered is stored locally — clear it
            anytime; replacing it just overwrites the previous value.
          </p>
          <div className={styles.coachFormRow}>
            <button type="button" className={styles.coachSecondaryBtn} onClick={() => setEditing(true)}>
              Replace key
            </button>
            <button type="button" className={styles.coachSecondaryBtn} onClick={clear}>
              Disconnect
            </button>
          </div>
          {editing && (
            <form
              className={styles.coachForm}
              onSubmit={(e) => { e.preventDefault(); save(); }}
            >
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className={styles.coachInput}
                autoFocus
              />
              <div className={styles.coachFormRow}>
                <button type="submit" className={styles.coachPrimaryBtn} disabled={!draft.trim()}>
                  Save new key
                </button>
                <button
                  type="button"
                  className={styles.coachSecondaryBtn}
                  onClick={() => { setEditing(false); setDraft(''); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.statTile}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
