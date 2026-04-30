import { useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { useClubMembers, useClubOverview, useRsvp } from '../../hooks/useClubs';
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

  // Track per-event optimistic RSVP state: eventId → { status, confirmed_count }
  // Populated optimistically on click; reverted on error.
  const [rsvpState, setRsvpState] = useState<
    Record<number, { status: 'going' | 'not_going'; confirmed_count: number } | undefined>
  >({});

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
            <UpcomingSection
              overview={overview}
              clubId={clubId}
              rsvpState={rsvpState}
              onRsvpStateChange={setRsvpState}
            />
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

      {/* ---- MEMBERS TAB (Phase 2 — v9.6.2) ---- */}
      {tab === 'members' && (
        <MembersTab members={members} />
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

type RsvpStateMap = Record<number, { status: 'going' | 'not_going'; confirmed_count: number } | undefined>;

function UpcomingSection({
  overview,
  clubId,
  rsvpState,
  onRsvpStateChange,
}: {
  overview: ReturnType<typeof useClubOverview>;
  clubId: number;
  rsvpState: RsvpStateMap;
  onRsvpStateChange: Dispatch<SetStateAction<RsvpStateMap>>;
}) {
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
      {events.map((e) => (
        <UpcomingEventRow
          key={e.id}
          event={e}
          clubId={clubId}
          rsvpOverride={rsvpState[e.id]}
          onRsvpStateChange={onRsvpStateChange}
        />
      ))}
    </div>
  );
}

function UpcomingEventRow({
  event,
  clubId,
  rsvpOverride,
  onRsvpStateChange,
}: {
  event: UpcomingEvent;
  clubId: number;
  rsvpOverride: { status: 'going' | 'not_going'; confirmed_count: number } | undefined;
  onRsvpStateChange: Dispatch<SetStateAction<RsvpStateMap>>;
}) {
  const rsvpMutation = useRsvp(clubId, event.id);
  const dt = new Date(event.event_date * 1000);
  const dayShort = dt.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNum = dt.toLocaleDateString('en-GB', { day: '2-digit' });
  const monShort = dt.toLocaleDateString('en-GB', { month: 'short' });
  const timeShort = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Resolved values: prefer optimistic override, fall back to server data.
  const currentStatus = rsvpOverride?.status ?? null;
  const confirmedCount = rsvpOverride?.confirmed_count ?? event.confirmed_count;
  const isGoing = currentStatus === 'going';

  function handleRsvp() {
    const nextStatus: 'going' | 'not_going' = isGoing ? 'not_going' : 'going';
    const delta = nextStatus === 'going' ? 1 : -1;
    // Optimistic update
    onRsvpStateChange((prev) => ({
      ...prev,
      [event.id]: {
        status: nextStatus,
        confirmed_count: Math.max(0, confirmedCount + delta),
      },
    }));
    rsvpMutation.mutate(nextStatus, {
      onSuccess: (data) => {
        // Reconcile with server's authoritative confirmed_count
        onRsvpStateChange((prev) => ({
          ...prev,
          [event.id]: { status: data.status, confirmed_count: data.confirmed_count },
        }));
      },
      onError: () => {
        // Revert optimistic update
        onRsvpStateChange((prev) => {
          const next = { ...prev };
          delete next[event.id];
          return next;
        });
      },
    });
  }

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
            {confirmedCount} confirmed
          </span>
        </div>
      </div>
      <button
        type="button"
        className={`${styles.rsvpBtn} ${isGoing ? styles.rsvpBtnGoing : ''}`}
        disabled={rsvpMutation.isPending}
        onClick={handleRsvp}
        aria-label={isGoing ? `Cancel RSVP for ${event.title}` : `RSVP to ${event.title}`}
        aria-pressed={isGoing}
      >
        {isGoing ? 'Cancel RSVP' : 'RSVP'}
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

/* ---------- Members tab ---------- */

type MemberSort = 'name' | 'role' | 'joined_at';

/**
 * MembersTab — Sprint 4 Phase 2 (v9.6.2). Replaces the placeholder.
 *
 * Columns: NAME / ROLE / JOINED.
 * FTP / Hours/Mo / Attended deferred — depend on users.ftp_w + activity rollups
 * (#52 Sprint 5). Sort dropdown (Name / Role / Joined), default Joined desc.
 * Search-as-you-type filters the loaded member list client-side (no round-trip).
 * Role chips: admin → "Captain", member → "Member".
 * "NEW" badge on members who joined within the last 30 days.
 * Member row click → inline expand showing avatar + joined date; role-change
 * controls deferred to Phase 5.
 *
 * FTP-visibility toggle UI deferred — no FTP column to expose yet. Backend
 * PATCH /api/users/me/profile + server-side FTP mask in GET /members are
 * wired for when #52 ships users.ftp_w.
 */
function MembersTab({ members }: { members: ReturnType<typeof useClubMembers> }) {
  const [sort, setSort] = useState<MemberSort>('joined_at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const allMembers = members.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMembers.filter((m) => {
      if (!q) return true;
      const name = `${m.firstname ?? ''} ${m.lastname ?? ''}`.toLowerCase();
      return name.includes(q) || m.role.toLowerCase().includes(q);
    });
  }, [allMembers, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sort === 'name') {
        const na = `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim().toLowerCase();
        const nb = `${b.firstname ?? ''} ${b.lastname ?? ''}`.trim().toLowerCase();
        cmp = na < nb ? -1 : na > nb ? 1 : 0;
      } else if (sort === 'role') {
        cmp = a.role < b.role ? -1 : a.role > b.role ? 1 : 0;
      } else {
        // joined_at
        cmp = a.joined_at - b.joined_at;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort, dir]);

  function toggleSort(next: MemberSort) {
    if (sort === next) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(next);
      setDir(next === 'joined_at' ? 'desc' : 'asc');
    }
  }

  if (members.isLoading) {
    return (
      <div className={styles.membersTab}>
        <div className={styles.empty}>Loading members…</div>
      </div>
    );
  }
  if (members.isError) {
    return (
      <div className={styles.membersTab}>
        <div className={styles.error}>Could not load members. Try again later.</div>
      </div>
    );
  }

  return (
    <div className={styles.membersTab}>
      {/* Controls row: search + sort */}
      <div className={styles.membersControls}>
        <input
          type="search"
          className={styles.membersSearch}
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search members"
        />
        <div className={styles.membersSortRow}>
          <span className={styles.membersSortLabel}>Sort:</span>
          {(['name', 'role', 'joined_at'] as MemberSort[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.membersSortBtn} ${sort === s ? styles.membersSortBtnActive : ''}`}
              onClick={() => toggleSort(s)}
              aria-pressed={sort === s}
            >
              {s === 'joined_at' ? 'Joined' : s === 'name' ? 'Name' : 'Role'}
              {sort === s && (
                <span aria-hidden="true" className={styles.membersSortArrow}>
                  {dir === 'asc' ? ' ↑' : ' ↓'}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Column header */}
      <div className={styles.membersTableHead}>
        <span className={styles.membersColName}>Name</span>
        <span className={styles.membersColRole}>Role</span>
        <span className={styles.membersColJoined}>Joined</span>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          {search ? 'No members match your search.' : 'No members yet.'}
        </div>
      ) : (
        <div className={styles.membersTable}>
          {sorted.map((m) => (
            <MembersTabRow
              key={m.athlete_id}
              member={m}
              expanded={expandedId === m.athlete_id}
              onToggle={() => setExpandedId((prev) => (prev === m.athlete_id ? null : m.athlete_id))}
            />
          ))}
        </div>
      )}

      <p className={styles.membersDeferredNote}>
        FTP · Hours/Mo · Attended columns — coming in Sprint 5 (#52).
      </p>
    </div>
  );
}

const THIRTY_DAYS_S = 30 * 24 * 3600;

function MembersTabRow({
  member,
  expanded,
  onToggle,
}: {
  member: ClubMember;
  expanded: boolean;
  onToggle: () => void;
}) {
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
  const isAdmin = member.role === 'admin';
  const roleLabel = isAdmin ? 'Captain' : 'Member';
  const isNew = Math.floor(Date.now() / 1000) - member.joined_at < THIRTY_DAYS_S;

  return (
    <div className={styles.membersRow}>
      <button
        type="button"
        className={styles.membersRowBtn}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${fullName}`}
      >
        <span className={styles.membersColName}>
          <span className={styles.memberNameText}>{fullName}</span>
          {isNew && <span className={styles.newBadge} aria-label="New member">NEW</span>}
        </span>
        <span className={styles.membersColRole}>
          <Pill dot tone={isAdmin ? 'accent' : undefined}>{roleLabel}</Pill>
        </span>
        <span className={styles.membersColJoined}>{joinedDate}</span>
      </button>

      {expanded && (
        <div className={styles.membersRowDrawer} role="region" aria-label={`${fullName} details`}>
          <div className={styles.membersDrawerInner}>
            {member.profile_url ? (
              <img src={member.profile_url} alt="" className={styles.drawerAvatar} />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">{initials}</span>
            )}
            <div className={styles.drawerBody}>
              <span className={styles.drawerName}>{fullName}</span>
              <span className={styles.drawerJoined}>Joined {joinedDate}</span>
              <span className={styles.drawerRole}>{roleLabel}</span>
              {/* Role-change controls: Phase 5 territory */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
