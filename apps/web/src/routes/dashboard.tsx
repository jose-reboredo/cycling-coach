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
import { computeTabsEnabled, useTabsEnabled, useClubsEnabled } from '../lib/featureFlags';
import { useAppContext } from '../lib/AppContext';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useRides } from '../hooks/useStravaData';
import { readTokens, clearTokens } from '../lib/auth';
import { MARCO } from '../lib/mockMarco';
import dashboardStyles from '../pages/Dashboard.module.css';

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
  const { athlete } = useRides({ enabled: !usingMock, ftp: 0 });

  const firstName = usingMock ? MARCO.firstName : athlete?.firstname ?? 'You';
  const lastName = usingMock ? MARCO.lastName : athlete?.lastname ?? '';
  const city = usingMock ? MARCO.city : athlete?.city ?? '';
  const profilePhoto = usingMock ? '' : athlete?.profile ?? '';
  const avatarInitials =
    (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase() || 'YOU';

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
          {/* DESKTOP TABS — Sprint 5 / v9.7.2 (#59). TopTabs visible ≥600px;
           *  BottomNav (rendered below) takes over on mobile. */}
          <Container width="wide">
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
