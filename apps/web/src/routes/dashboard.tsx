import { useMemo } from 'react';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Dashboard } from '../pages/Dashboard';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { TopTabs } from '../components/TopTabs/TopTabs';
import { TopBar } from '../components/TopBar/TopBar';
import { UserMenu } from '../components/UserMenu/UserMenu';
import { ContextSwitcher } from '../components/ContextSwitcher/ContextSwitcher';
import { ClubCreateCard } from '../components/ClubCreateCard/ClubCreateCard';
import { ClubDashboard } from '../components/ClubDashboard/ClubDashboard';
import { Container } from '../components/Container/Container';
import { Pill } from '../components/Pill/Pill';
import { computeTabsEnabled, useTabsEnabled, useClubsEnabled } from '../lib/featureFlags';
import { useAppContext } from '../lib/AppContext';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useRides } from '../hooks/useStravaData';
import { readTokens, clearTokens } from '../lib/auth';
import { MARCO, MOCK_ACTIVITIES } from '../lib/mockMarco';
import dashboardStyles from '../pages/Dashboard.module.css';

/** v10.3.0 — Time-of-day greeting verb for the layout-level salutation. */
function greetingForHour(h: number): string {
  if (h < 5) return 'Late night';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

/** v10.3.0 — Consecutive-day streak ending at the most-recent activity.
 *  Lifted from dashboard.today.tsx so the layout salutation row can render
 *  the streak chip beside the greeting (matches ClubDashboard's pattern of
 *  putting context info above its TopTabs). */
function computeStreak(activities: { date: string }[]): number {
  if (activities.length === 0) return 0;
  const dateKeys = new Set(activities.map((a) => a.date.slice(0, 10)));
  const sortedDesc = Array.from(dateKeys).sort((a, b) => b.localeCompare(a));
  if (sortedDesc.length === 0) return 0;
  const cursor = new Date(`${sortedDesc[0]}T12:00:00`);
  let count = 0;
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (dateKeys.has(key)) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ location }) => {
    // v9.3.2 fix — only redirect bare /dashboard, NOT sub-routes. Parent
    // beforeLoad fires on every nested navigation in Tanstack Router; without
    // the pathname guard, navigating to /dashboard/today re-triggers another
    // redirect to /dashboard/today → infinite loop, JS thread blocked, React
    // never mounts, page renders blank. That was the v9.3.1 prod regression.
    if (location.pathname === '/dashboard' && computeTabsEnabled()) {
      throw redirect({ to: '/dashboard/today' });
    }
  },
  component: DashboardRoute,
});

function DashboardRoute() {
  const tabsEnabled = useTabsEnabled();

  if (!tabsEnabled) {
    return <Dashboard />;
  }

  return <TabsLayout />;
}

function TabsLayout() {
  const queryClient = useQueryClient();
  const tokens = readTokens();
  const isDemo = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1',
    [],
  );
  const usingMock = !tokens || isDemo;

  const profile = useAthleteProfile();
  const { athlete, rides } = useRides({ enabled: !usingMock, ftp: 0 });

  const firstName = usingMock ? MARCO.firstName : athlete?.firstname ?? 'You';
  const lastName = usingMock ? MARCO.lastName : athlete?.lastname ?? '';
  const city = usingMock ? MARCO.city : athlete?.city ?? '';
  const profilePhoto = usingMock ? '' : athlete?.profile ?? '';
  const avatarInitials =
    (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase() || 'YOU';

  // v10.3.0 — layout-level salutation values; previously inside dashboard.today.tsx.
  const activities = usingMock ? MOCK_ACTIVITIES : rides;
  const streak = useMemo(() => computeStreak(activities), [activities]);
  const greeting = greetingForHour(new Date().getHours());

  // v9.3.4 — clubs feature also lifted into tabs layout. Mirrors the legacy
  // Dashboard.tsx pattern: TopBar gets ContextSwitcher (always-visible toggle
  // when clubsEnabled), and when scope.mode === 'club' the tabs view swaps
  // its Outlet for ClubDashboard. ClubCreateCard renders above ClubDashboard
  // (it self-hides when the user already owns a club).
  const { scope } = useAppContext();
  const clubsEnabled = useClubsEnabled();
  const isClubMode = clubsEnabled && scope.mode === 'club' && scope.clubId != null;

  return (
    <>
      <TopBar
        variant="app"
        trailing={
          <>
            {clubsEnabled ? <ContextSwitcher /> : null}
            <UserMenu
              username={`${firstName}${lastName ? ' ' + lastName : ''}`}
              onSync={() => {
                queryClient.invalidateQueries({ queryKey: ['athlete'] });
                queryClient.invalidateQueries({ queryKey: ['activities'] });
              }}
              onDisconnect={() => {
                clearTokens();
                if (typeof window !== 'undefined') window.location.href = '/';
              }}
              onEditProfile={() => profile.resetDismissal()}
            >
              <span className={dashboardStyles.userPill}>
                {profilePhoto ? (
                  <img src={profilePhoto} alt="" className={dashboardStyles.userPhoto} />
                ) : (
                  <span className={dashboardStyles.userAvatar}>{avatarInitials}</span>
                )}
                <span className={dashboardStyles.userMeta}>
                  <span className={dashboardStyles.userName}>
                    {firstName} {lastName.charAt(0)}
                    {lastName ? '.' : ''}
                  </span>
                  {city ? <span className={dashboardStyles.userCity}>{city}</span> : null}
                </span>
              </span>
            </UserMenu>
          </>
        }
      />

      {isClubMode ? (
        <main id="main">
          <Container width="wide">
            <ClubCreateCard />
            <ClubDashboard
              clubId={scope.clubId as number}
              clubName={scope.clubName ?? 'Club'}
              role={scope.role ?? 'member'}
            />
          </Container>
        </main>
      ) : (
        <>
          {/* v10.3.0 — Salutation header lives at layout level, above
           *  TopTabs. Mirrors ClubDashboard pattern (club header + tabs).
           *  Each tab's content sits below; tabs no longer render their
           *  own greeting line. */}
          <Container width="wide">
            <header className={dashboardStyles.salutationRow}>
              {/* v10.5.0 — Same brutalist treatment as ClubDashboard's
                  "Merkle Riders." slim header for visual consistency
                  across templates. Bold sans-serif, white, accent
                  em-period at the end. */}
              <h1 className={dashboardStyles.salutationName}>
                {greeting}, {firstName}
                {lastName ? ` ${lastName.charAt(0)}` : ''}<em>.</em>
              </h1>
              <div className={dashboardStyles.salutationChips}>
                <Pill dot tone="success">
                  {usingMock ? 'Demo data' : 'In sync'}
                </Pill>
                {streak > 0 && (
                  <Pill tone="accent">{streak}-day streak</Pill>
                )}
              </div>
            </header>
            <TopTabs
              ariaLabel="Dashboard tabs"
              items={[
                { id: 'today', label: 'Today', to: '/dashboard/today' },
                { id: 'schedule', label: 'Schedule', to: '/dashboard/schedule' },
                { id: 'train', label: 'Train', to: '/dashboard/train' },
                { id: 'rides', label: 'Rides', to: '/dashboard/rides' },
                { id: 'you', label: 'You', to: '/dashboard/you' },
              ]}
            />
          </Container>
          <Outlet />
          <BottomNav />
        </>
      )}
    </>
  );
}
