import { useMemo } from 'react';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Dashboard } from '../pages/Dashboard';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { TopBar } from '../components/TopBar/TopBar';
import { UserMenu } from '../components/UserMenu/UserMenu';
import { computeTabsEnabled, useTabsEnabled } from '../lib/featureFlags';
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

  // Flag is on — tabs layout shell. Renders TopBar (v9.3.3 fix — was
  // missing from v9.3.1/v9.3.2; tabs view had no brand bar at all),
  // Outlet for the active sub-route, and BottomNav for navigation.
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

  return (
    <>
      <TopBar
        variant="app"
        trailing={
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
        }
      />
      <Outlet />
      <BottomNav />
    </>
  );
}
