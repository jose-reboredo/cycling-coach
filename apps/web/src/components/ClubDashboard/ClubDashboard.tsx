import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { useClubMembers } from '../../hooks/useClubs';
import type { ClubMember } from '../../lib/clubsApi';
import styles from './ClubDashboard.module.css';

interface ClubDashboardProps {
  clubId: number;
  clubName: string;
  role: string;
}

/**
 * ClubDashboard — the body content shown on Dashboard when AppContext.scope.mode
 * is 'club'. Replaces the entire individual Dashboard layout in club mode.
 *
 * Structure:
 *   - Club header: name + role + member count
 *   - Members section: avatars + names + join dates from /api/clubs/:id/members
 *   - Stat-tile placeholders: "0 rides this week" / "0 active members" / "—"
 *   - Coming-soon card: collective goals, club rides, coach dashboard
 *   - Hint: switch to My Account to see personal stats
 *
 * Switching back to individual mode is via the ContextSwitcher in TopBar.
 */
export function ClubDashboard({ clubId, clubName, role }: ClubDashboardProps) {
  const members = useClubMembers(clubId);
  const memberCount = members.data?.length ?? 0;

  return (
    <div className={styles.root}>
      <ClubHeader name={clubName} role={role} memberCount={memberCount} />

      <section className={styles.section}>
        <div className={styles.statRow}>
          <StatTile value="0" label="Rides this week" />
          <StatTile value="0" label="Active members" />
          <StatTile value="—" label="Collective load" />
        </div>
      </section>

      <section className={styles.section}>
        <Eyebrow rule>Members</Eyebrow>
        <MembersList state={members} />
      </section>

      <section className={styles.section}>
        <Eyebrow rule tone="accent">Roadmap</Eyebrow>
        <div className={styles.comingSoon}>
          <p className={styles.comingSoonTitle}>Coming next.</p>
          <div className={styles.comingSoonList}>
            <span className={styles.comingSoonItem}>
              Collective goals — distance / elevation / consistency targets per
              calendar window.
            </span>
            <span className={styles.comingSoonItem}>
              Club rides — schedule a session, members RSVP, post-ride debrief
              card.
            </span>
            <span className={styles.comingSoonItem}>
              Coach dashboard — admin-only view of every member's weekly load,
              flag overreach early.
            </span>
            <span className={styles.comingSoonItem}>
              Email invitations — invite teammates by address with role pre-set.
            </span>
          </div>
        </div>
      </section>

      <p className={styles.hint}>
        Personal training stats are hidden in club view. Switch back to
        <strong> My account</strong> via the context pill in the top bar.
      </p>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function ClubHeader({
  name,
  role,
  memberCount,
}: {
  name: string;
  role: string;
  memberCount: number;
}) {
  const roleTone: 'accent' | 'success' = role === 'admin' ? 'accent' : 'success';
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <Eyebrow rule tone="accent">Club</Eyebrow>
        <Pill dot tone={roleTone}>{role}</Pill>
      </div>
      <h1 className={styles.title}>
        <em>{name}</em>
      </h1>
      <div className={styles.metaRow}>
        <span className={styles.metaCount}>
          <strong>{memberCount}</strong>
          {memberCount === 1 ? 'member' : 'members'}
        </span>
      </div>
    </header>
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
  const roleTone: 'accent' | 'success' = member.role === 'admin' ? 'accent' : 'success';
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
      <Pill dot tone={roleTone}>{member.role}</Pill>
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
