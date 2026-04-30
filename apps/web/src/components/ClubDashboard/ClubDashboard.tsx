import { useState } from 'react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { useClubMembers, useClubOverview } from '../../hooks/useClubs';
import { ClubEventModal } from '../ClubEventModal/ClubEventModal';
import type { ClubMember, UpcomingEvent } from '../../lib/clubsApi';
import styles from './ClubDashboard.module.css';

interface ClubDashboardProps {
  clubId: number;
  clubName: string;
  role: string;
}

type Tab = 'overview' | 'schedule' | 'members' | 'metrics';

/**
 * ClubDashboard — Sprint 4 Phase 1 restructure (v9.6.0).
 *
 * Changes from v9.1.2:
 * - Cover hero dropped per founder mid-stream directive (2026-04-30).
 *   Replaced with a slim sticky header: club name + metadata band
 *   (EST. year · N members · PRIVATE).
 * - Overview tab wired to new GET /api/clubs/:id/overview endpoint via
 *   useClubOverview hook. Stat tiles now consume live 28-day aggregations.
 * - Upcoming section upgraded: confirmed-count placeholder + disabled RSVP
 *   button (Phase 2 wires the write path).
 * - Circle Note section visible to all members; plain text for Phase 1
 *   (Phase 5 adds AI draft + editor).
 * - Schedule / Members / Metrics tabs are navigable (not disabled) with
 *   placeholder content for now.
 * - Coach AI card + "Coming next" roadmap section removed from Overview;
 *   retained logic is in sub-components below.
 *
 * Information architecture (4-tab shell):
 *   Overview / Schedule / Members / Metrics
 */
export function ClubDashboard({ clubId, clubName, role }: ClubDashboardProps) {
  const overview = useClubOverview(clubId);
  const members = useClubMembers(clubId);
  const memberCount = members.data?.length ?? 0;
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState<Tab>('overview');
  const [eventModalOpen, setEventModalOpen] = useState(false);

  const club = overview.data?.club;
  const createdYear = club?.created_at
    ? new Date(club.created_at * 1000).getFullYear()
    : new Date().getFullYear();

  return (
    <div className={styles.root}>
      {/* SLIM STICKY HEADER — club name + metadata band. Replaces the old cover hero.
       * Reclaims ~280 px of vertical space for content (founder directive 2026-04-30). */}
      <header className={styles.slimHeader}>
        <h1 className={styles.slimHeaderName}>
          {clubName.endsWith('.') ? clubName : <>{clubName}<em>.</em></>}
        </h1>
        <div className={styles.slimHeaderMeta}>
          <span className={styles.slimHeaderBand}>
            EST. {createdYear} · {memberCount} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'} · PRIVATE
          </span>
          {isAdmin ? (
            <Pill dot tone="accent">{role}</Pill>
          ) : (
            <Pill dot>{role}</Pill>
          )}
        </div>
      </header>

      {/* TABS — Overview / Schedule / Members / Metrics */}
      <nav className={styles.tabs} aria-label="Club views">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')} label="Overview" />
        <TabBtn active={tab === 'schedule'} onClick={() => setTab('schedule')} label="Schedule" />
        <TabBtn active={tab === 'members'} onClick={() => setTab('members')} label="Members" />
        <TabBtn active={tab === 'metrics'} onClick={() => setTab('metrics')} label="Metrics" />
      </nav>

      {/* ---- OVERVIEW TAB ---- */}
      {tab === 'overview' && (
        <>
          {/* INVITE LINK — admin-only */}
          {isAdmin && club?.invite_code && (
            <section className={styles.section}>
              <Eyebrow rule tone="accent">Invite</Eyebrow>
              <InviteHeroCta code={club.invite_code} />
            </section>
          )}

          {/* STAT TILES — wired to /api/clubs/:id/overview 28-day aggregations */}
          <section className={styles.section}>
            <Eyebrow>The circle, this month</Eyebrow>
            <StatTilesSection overview={overview} />
          </section>

          {/* UPCOMING — events with placeholder RSVP button (Phase 2 wires the write) */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <Eyebrow rule>Upcoming</Eyebrow>
              {isAdmin && (
                <button
                  type="button"
                  className={styles.sectionAction}
                  onClick={() => setEventModalOpen(true)}
                >
                  + Post event
                </button>
              )}
            </div>
            <UpcomingSection overview={overview} />
          </section>

          {/* CIRCLE NOTE — plain text for Phase 1. Phase 5 adds AI draft + editor. */}
          <section className={styles.section}>
            <Eyebrow rule>Circle note</Eyebrow>
            <CircleNoteSection circleNote={overview.data?.circle_note ?? null} isLoading={overview.isLoading} />
          </section>

          {/* MEMBERS RAIL */}
          <section className={styles.section}>
            <Eyebrow rule>Members · {String(memberCount).padStart(2, '0')}</Eyebrow>
            <MembersList state={members} />
          </section>

          <p className={styles.hint}>
            Personal training stats are hidden in club view. Switch back to
            <strong> My account</strong> via the context pill in the top bar.
          </p>
        </>
      )}

      {/* ---- SCHEDULE TAB (Phase 3 — v9.6.2) ---- */}
      {tab === 'schedule' && (
        <div className={styles.tabPlaceholder}>
          <Eyebrow rule tone="accent">Schedule</Eyebrow>
          <p className={styles.tabPlaceholderBody}>Coming in v9.6.2</p>
        </div>
      )}

      {/* ---- MEMBERS TAB (Phase 2 — v9.6.1) ---- */}
      {tab === 'members' && (
        <div className={styles.tabPlaceholder}>
          <Eyebrow rule tone="accent">Members</Eyebrow>
          <p className={styles.tabPlaceholderBody}>Coming in v9.6.1</p>
        </div>
      )}

      {/* ---- METRICS TAB (Phase 5 — v9.6.4) ---- */}
      {tab === 'metrics' && (
        <div className={styles.tabPlaceholder}>
          <Eyebrow rule tone="accent">Metrics</Eyebrow>
          <p className={styles.tabPlaceholderBody}>Coming in v9.6.4</p>
        </div>
      )}

      <ClubEventModal
        open={eventModalOpen}
        clubId={clubId}
        onClose={() => setEventModalOpen(false)}
      />
    </div>
  );
}

/* ---------- sub-components ---------- */

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.tab} ${active ? styles.tabActive : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </button>
  );
}

function StatTilesSection({ overview }: { overview: ReturnType<typeof useClubOverview> }) {
  if (overview.isLoading) {
    return (
      <div className={styles.statRow}>
        {['Hours collective', 'Distance · km', 'Group rides', 'New members'].map((label) => (
          <div key={label} className={styles.statTile}>
            <span className={`${styles.statValue} ${styles.statSkeleton}`}>—</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>
    );
  }
  const tiles = overview.data?.stat_tiles;
  return (
    <div className={styles.statRow}>
      <StatTile value={tiles ? String(tiles.hours_28d) : '—'} label="Hours collective" />
      <StatTile value={tiles ? String(tiles.distance_28d) : '0'} label="Distance · km" />
      <StatTile value={tiles ? String(tiles.ride_count_28d) : '0'} label="Group rides" />
      <StatTile value={tiles ? String(tiles.new_members_28d) : '0'} label="New members" />
    </div>
  );
}

function UpcomingSection({ overview }: { overview: ReturnType<typeof useClubOverview> }) {
  if (overview.isLoading) {
    return <div className={styles.empty}>Loading upcoming rides…</div>;
  }
  if (overview.isError) {
    return <div className={styles.error}>Could not load upcoming rides.</div>;
  }
  const events = overview.data?.upcoming_events ?? [];
  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        No upcoming rides yet.
      </div>
    );
  }
  return (
    <div className={styles.events}>
      {events.map((e) => <UpcomingEventRow key={e.id} event={e} />)}
    </div>
  );
}

function UpcomingEventRow({ event }: { event: UpcomingEvent }) {
  const dt = new Date(event.event_date * 1000);
  const dayShort = dt.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNum = dt.toLocaleDateString('en-GB', { day: '2-digit' });
  const monShort = dt.toLocaleDateString('en-GB', { month: 'short' });
  const timeShort = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <article className={styles.eventRow}>
      <div className={styles.eventDate} aria-hidden="true">
        <span className={styles.eventDateDay}>{dayShort}</span>
        <span className={styles.eventDateNum}>{dayNum}</span>
        <span className={styles.eventDateMon}>{monShort}</span>
      </div>
      <div className={styles.eventBody}>
        <h3 className={styles.eventTitle}>{event.title}</h3>
        <div className={styles.eventMeta}>
          <span className={styles.eventMetaTime}>{timeShort}</span>
          {event.location && (
            <>
              <span className={styles.eventMetaDot} aria-hidden="true">·</span>
              <span className={styles.eventMetaLoc}>{event.location}</span>
            </>
          )}
          <span className={styles.eventMetaDot} aria-hidden="true">·</span>
          <span className={styles.eventMetaConfirmed}>
            {event.confirmed_count} confirmed
          </span>
        </div>
      </div>
      {/* Phase 2 wires the actual RSVP write path */}
      <button
        type="button"
        className={styles.rsvpBtn}
        disabled
        aria-label={`RSVP to ${event.title} — coming soon`}
        title="RSVP coming in v9.6.1"
      >
        RSVP
      </button>
    </article>
  );
}

function CircleNoteSection({
  circleNote,
  isLoading,
}: {
  circleNote: string | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className={styles.circleNote}>
        <p className={styles.circleNoteBody}>Loading…</p>
      </div>
    );
  }
  return (
    <div className={styles.circleNote}>
      <p className={styles.circleNoteBody}>
        {circleNote ?? 'No notes yet — your captain can post one.'}
      </p>
      {!circleNote && (
        <span className={styles.circleNoteSig}>— Circle Note · Phase 5 adds AI draft + editor</span>
      )}
    </div>
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
  const memberList = state.data ?? [];
  if (memberList.length === 0) {
    return <div className={styles.empty}>No members yet.</div>;
  }
  return (
    <div className={styles.members}>
      {memberList.map((m) => <MemberRow key={m.athlete_id} member={m} />)}
    </div>
  );
}

function MemberRow({ member }: { member: ClubMember }) {
  const fullName =
    [member.firstname, member.lastname].filter(Boolean).join(' ').trim() ||
    `Athlete ${member.athlete_id}`;
  const initials =
    [member.firstname?.[0], member.lastname?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const joinedDate = new Date(member.joined_at * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const isAdminMember = member.role === 'admin';
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
      {isAdminMember ? (
        <Pill dot tone="accent">{member.role}</Pill>
      ) : (
        <Pill dot>{member.role}</Pill>
      )}
    </div>
  );
}

function InviteHeroCta({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== 'undefined'
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

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.statTile}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
